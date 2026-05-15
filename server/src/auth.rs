use actix_web::{
    body::EitherBody,
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage, HttpResponse,
    web,
};
use futures_util::future::{ok, LocalBoxFuture, Ready};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::rc::Rc;

use crate::AppState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String, // user_id
    pub username: String,
    pub exp: usize,
}

pub fn create_token(user_id: &str, username: &str, secret: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let expiration = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::hours(24))
        .expect("valid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        sub: user_id.to_string(),
        username: username.to_string(),
        exp: expiration,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

pub fn validate_token(token: &str, secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(token_data.claims)
}

// ─── Middleware ──────────────────────────────────────────────────────────────

pub struct AuthMiddlewareFactory;

impl<S, B> Transform<S, ServiceRequest> for AuthMiddlewareFactory
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Transform = AuthMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(AuthMiddleware {
            service: Rc::new(service),
        })
    }
}

pub struct AuthMiddleware<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for AuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();

        Box::pin(async move {
            // Extract JWT from Authorization header
            let auth_header = req
                .headers()
                .get("Authorization")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string());

            let token = match auth_header {
                Some(ref header) if header.starts_with("Bearer ") => {
                    header[7..].to_string()
                }
                _ => {
                    let response = HttpResponse::Unauthorized()
                        .json(serde_json::json!({"error": "Missing or invalid Authorization header"}));
                    return Ok(req.into_response(response).map_into_right_body());
                }
            };

            // Get the JWT secret from app state
            let state = req.app_data::<web::Data<AppState>>().unwrap();
            let secret = &state.config.jwt_secret;

            match validate_token(&token, secret) {
                Ok(claims) => {
                    req.extensions_mut().insert(claims);
                    let res = service.call(req).await?;
                    Ok(res.map_into_left_body())
                }
                Err(_) => {
                    let response = HttpResponse::Unauthorized()
                        .json(serde_json::json!({"error": "Invalid or expired token"}));
                    Ok(req.into_response(response).map_into_right_body())
                }
            }
        })
    }
}

