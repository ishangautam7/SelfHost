use actix_web::{web, HttpRequest, HttpResponse, HttpMessage};
use shared::models::*;
use crate::AppState;
use crate::auth::{self, Claims};

/// POST /api/auth/register
pub async fn register(
    state: web::Data<AppState>,
    body: web::Json<RegisterRequest>,
) -> HttpResponse {
    // Validate input
    if body.username.trim().is_empty() || body.password.len() < 6 {
        return HttpResponse::BadRequest().json(ApiResponse::<()>::err(
            "Username required, password must be at least 6 characters",
        ));
    }

    // Check if username exists
    match state.db.get_user_by_username(&body.username).await {
        Ok(Some(_)) => {
            return HttpResponse::Conflict()
                .json(ApiResponse::<()>::err("Username already taken"));
        }
        Err(e) => {
            log::error!("DB error: {}", e);
            return HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::err("Internal server error"));
        }
        _ => {}
    }

    // Hash password
    let password_hash = match hash_password(&body.password) {
        Ok(h) => h,
        Err(e) => {
            log::error!("Hash error: {}", e);
            return HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::err("Internal server error"));
        }
    };

    let user_id = new_id();
    let api_key = format!("sk_{}", new_id().replace('-', ""));

    if let Err(e) = state
        .db
        .create_user(&user_id, &body.username, &password_hash, &api_key)
        .await
    {
        log::error!("DB error: {}", e);
        return HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err("Failed to create user"));
    }

    // Generate JWT
    let token = match auth::create_token(&user_id, &body.username, &state.config.jwt_secret) {
        Ok(t) => t,
        Err(e) => {
            log::error!("Token error: {}", e);
            return HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::err("Failed to generate token"));
        }
    };

    HttpResponse::Created().json(ApiResponse::ok(AuthResponse {
        token,
        user: UserPublic {
            id: user_id,
            username: body.username.clone(),
            api_key,
        },
    }))
}

/// POST /api/auth/login
pub async fn login(
    state: web::Data<AppState>,
    body: web::Json<LoginRequest>,
) -> HttpResponse {
    let user = match state.db.get_user_by_username(&body.username).await {
        Ok(Some(u)) => u,
        Ok(None) => {
            return HttpResponse::Unauthorized()
                .json(ApiResponse::<()>::err("Invalid credentials"));
        }
        Err(e) => {
            log::error!("DB error: {}", e);
            return HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::err("Internal server error"));
        }
    };

    if !verify_password(&body.password, &user.password_hash) {
        return HttpResponse::Unauthorized()
            .json(ApiResponse::<()>::err("Invalid credentials"));
    }

    let token = match auth::create_token(&user.id, &user.username, &state.config.jwt_secret) {
        Ok(t) => t,
        Err(e) => {
            log::error!("Token error: {}", e);
            return HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::err("Failed to generate token"));
        }
    };

    HttpResponse::Ok().json(ApiResponse::ok(AuthResponse {
        token,
        user: UserPublic {
            id: user.id,
            username: user.username,
            api_key: user.api_key,
        },
    }))
}

/// GET /api/me
pub async fn me(
    state: web::Data<AppState>,
    req: HttpRequest,
) -> HttpResponse {
    let claims = req.extensions().get::<Claims>().unwrap().clone();

    match state.db.get_user_by_id(&claims.sub).await {
        Ok(Some(user)) => HttpResponse::Ok().json(ApiResponse::ok(UserPublic {
            id: user.id,
            username: user.username,
            api_key: user.api_key,
        })),
        _ => HttpResponse::NotFound().json(ApiResponse::<()>::err("User not found")),
    }
}

// ─── Password Hashing ───────────────────────────────────────────────────────

fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    use argon2::{
        password_hash::{rand_core::OsRng, SaltString},
        Argon2, PasswordHasher,
    };
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2.hash_password(password.as_bytes(), &salt)?;
    Ok(hash.to_string())
}

fn verify_password(password: &str, hash: &str) -> bool {
    use argon2::{Argon2, PasswordHash, PasswordVerifier};
    let parsed = match PasswordHash::new(hash) {
        Ok(h) => h,
        Err(_) => return false,
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}
