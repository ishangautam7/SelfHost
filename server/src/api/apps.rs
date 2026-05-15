use actix_web::{web, HttpRequest, HttpResponse, HttpMessage};
use shared::models::*;
use crate::AppState;
use crate::auth::Claims;

/// GET /api/apps
pub async fn list_apps(
    state: web::Data<AppState>,
    req: HttpRequest,
) -> HttpResponse {
    let claims = req.extensions().get::<Claims>().unwrap().clone();

    match state.db.list_apps_by_user(&claims.sub).await {
        Ok(apps) => HttpResponse::Ok().json(ApiResponse::ok(apps)),
        Err(e) => {
            log::error!("DB error: {}", e);
            HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::err("Failed to list apps"))
        }
    }
}

/// POST /api/apps
pub async fn create_app(
    state: web::Data<AppState>,
    req: HttpRequest,
    body: web::Json<CreateAppRequest>,
) -> HttpResponse {
    let claims = req.extensions().get::<Claims>().unwrap().clone();

    // Validate subdomain (alphanumeric + hyphens only)
    let subdomain = body.subdomain.trim().to_lowercase();
    if subdomain.is_empty() || !subdomain.chars().all(|c| c.is_alphanumeric() || c == '-') {
        return HttpResponse::BadRequest().json(ApiResponse::<()>::err(
            "Subdomain must be alphanumeric (hyphens allowed)",
        ));
    }

    // Check subdomain uniqueness
    match state.db.get_app_by_subdomain(&subdomain).await {
        Ok(Some(_)) => {
            return HttpResponse::Conflict()
                .json(ApiResponse::<()>::err("Subdomain already taken"));
        }
        Err(e) => {
            log::error!("DB error: {}", e);
            return HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::err("Internal server error"));
        }
        _ => {}
    }

    let app_id = new_id();
    let resource_cpu = body.resource_cpu.unwrap_or(1);
    let resource_memory = body.resource_memory.unwrap_or(512);

    if let Err(e) = state
        .db
        .create_app(
            &app_id,
            &claims.sub,
            &body.name,
            &subdomain,
            body.local_port,
            resource_cpu,
            resource_memory,
        )
        .await
    {
        log::error!("DB error: {}", e);
        return HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err("Failed to create app"));
    }

    let full_domain = format!("{}.{}", subdomain, state.config.base_domain);
    log::info!("📦 App created: {} → {}", body.name, full_domain);

    let app = App {
        id: app_id,
        user_id: claims.sub,
        name: body.name.clone(),
        subdomain: subdomain.clone(),
        local_port: body.local_port,
        status: AppStatus::Stopped,
        resource_cpu,
        resource_memory,
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    HttpResponse::Created().json(ApiResponse::ok(app))
}

/// GET /api/apps/{id}
pub async fn get_app(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<String>,
) -> HttpResponse {
    let claims = req.extensions().get::<Claims>().unwrap().clone();
    let app_id = path.into_inner();

    match state.db.get_app(&app_id).await {
        Ok(Some(app)) if app.user_id == claims.sub => {
            HttpResponse::Ok().json(ApiResponse::ok(app))
        }
        Ok(Some(_)) => {
            HttpResponse::Forbidden().json(ApiResponse::<()>::err("Not your app"))
        }
        Ok(None) => {
            HttpResponse::NotFound().json(ApiResponse::<()>::err("App not found"))
        }
        Err(e) => {
            log::error!("DB error: {}", e);
            HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::err("Internal server error"))
        }
    }
}

/// PUT /api/apps/{id}
pub async fn update_app(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<String>,
    body: web::Json<UpdateAppRequest>,
) -> HttpResponse {
    let claims = req.extensions().get::<Claims>().unwrap().clone();
    let app_id = path.into_inner();

    // Verify ownership
    match state.db.get_app(&app_id).await {
        Ok(Some(app)) if app.user_id == claims.sub => {}
        Ok(Some(_)) => {
            return HttpResponse::Forbidden()
                .json(ApiResponse::<()>::err("Not your app"));
        }
        Ok(None) => {
            return HttpResponse::NotFound()
                .json(ApiResponse::<()>::err("App not found"));
        }
        Err(e) => {
            log::error!("DB error: {}", e);
            return HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::err("Internal server error"));
        }
    }

    if let Err(e) = state
        .db
        .update_app(
            &app_id,
            body.name.as_deref(),
            body.local_port,
            body.resource_cpu,
            body.resource_memory,
        )
        .await
    {
        log::error!("DB error: {}", e);
        return HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err("Failed to update app"));
    }

    // Return updated app
    match state.db.get_app(&app_id).await {
        Ok(Some(app)) => HttpResponse::Ok().json(ApiResponse::ok(app)),
        _ => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err("Failed to fetch updated app")),
    }
}

/// DELETE /api/apps/{id}
pub async fn delete_app(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<String>,
) -> HttpResponse {
    let claims = req.extensions().get::<Claims>().unwrap().clone();
    let app_id = path.into_inner();

    // Verify ownership
    match state.db.get_app(&app_id).await {
        Ok(Some(app)) if app.user_id == claims.sub => {}
        Ok(Some(_)) => {
            return HttpResponse::Forbidden()
                .json(ApiResponse::<()>::err("Not your app"));
        }
        Ok(None) => {
            return HttpResponse::NotFound()
                .json(ApiResponse::<()>::err("App not found"));
        }
        Err(e) => {
            log::error!("DB error: {}", e);
            return HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::err("Internal server error"));
        }
    }

    if let Err(e) = state.db.delete_app(&app_id).await {
        log::error!("DB error: {}", e);
        return HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err("Failed to delete app"));
    }

    HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({"deleted": true})))
}

/// POST /api/apps/{id}/start
pub async fn start_app(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<String>,
) -> HttpResponse {
    let claims = req.extensions().get::<Claims>().unwrap().clone();
    let app_id = path.into_inner();

    // Verify ownership
    let app = match state.db.get_app(&app_id).await {
        Ok(Some(app)) if app.user_id == claims.sub => app,
        Ok(Some(_)) => {
            return HttpResponse::Forbidden()
                .json(ApiResponse::<()>::err("Not your app"));
        }
        Ok(None) => {
            return HttpResponse::NotFound()
                .json(ApiResponse::<()>::err("App not found"));
        }
        Err(e) => {
            log::error!("DB error: {}", e);
            return HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::err("Internal server error"));
        }
    };

    // Send start command through tunnel
    let tunnel_mgr = state.tunnel_manager.read().await;
    if let Some(sender) = tunnel_mgr.get_sender(&app.user_id) {
        let cmd = shared::tunnel::TunnelMessage::AgentCommand {
            command: shared::tunnel::AgentCommandType::Start,
            app_id: app.id.clone(),
            app_name: app.name.clone(),
            local_port: app.local_port,
        };
        let msg = serde_json::to_string(&cmd).unwrap();
        let _ = sender.send(msg).await;

        // Update status
        let _ = state.db.update_app_status(&app_id, "deploying").await;

        HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({
            "message": "Start command sent to agent",
            "status": "deploying"
        })))
    } else {
        HttpResponse::ServiceUnavailable().json(ApiResponse::<()>::err(
            "No agent connected. Please start the agent on your device first.",
        ))
    }
}

/// POST /api/apps/{id}/stop
pub async fn stop_app(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<String>,
) -> HttpResponse {
    let claims = req.extensions().get::<Claims>().unwrap().clone();
    let app_id = path.into_inner();

    let app = match state.db.get_app(&app_id).await {
        Ok(Some(app)) if app.user_id == claims.sub => app,
        Ok(Some(_)) => {
            return HttpResponse::Forbidden()
                .json(ApiResponse::<()>::err("Not your app"));
        }
        Ok(None) => {
            return HttpResponse::NotFound()
                .json(ApiResponse::<()>::err("App not found"));
        }
        Err(e) => {
            log::error!("DB error: {}", e);
            return HttpResponse::InternalServerError()
                .json(ApiResponse::<()>::err("Internal server error"));
        }
    };

    let tunnel_mgr = state.tunnel_manager.read().await;
    if let Some(sender) = tunnel_mgr.get_sender(&app.user_id) {
        let cmd = shared::tunnel::TunnelMessage::AgentCommand {
            command: shared::tunnel::AgentCommandType::Stop,
            app_id: app.id.clone(),
            app_name: app.name.clone(),
            local_port: app.local_port,
        };
        let msg = serde_json::to_string(&cmd).unwrap();
        let _ = sender.send(msg).await;

        let _ = state.db.update_app_status(&app_id, "stopped").await;

        HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({
            "message": "Stop command sent to agent",
            "status": "stopped"
        })))
    } else {
        // Just update the DB status
        let _ = state.db.update_app_status(&app_id, "stopped").await;
        HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({
            "message": "App marked as stopped (no agent connected)",
            "status": "stopped"
        })))
    }
}
