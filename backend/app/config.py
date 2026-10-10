from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./intervexa.db"
    app_origin: str = "http://localhost:3000"
    environment: str = "development"
    session_secret: str = ""
    github_app_id: str = ""
    github_app_slug: str = ""
    github_private_key_path: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""
    github_webhook_secret: str = ""
    github_publish_checks: bool = False
    sandbox_url: str = ""
    sandbox_token: str = ""
    allowed_origins: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    github_login_client_id: str = ""
    github_login_client_secret: str = ""

    @property
    def origins(self) -> list[str]:
        origins = [self.app_origin, *[o.strip() for o in self.allowed_origins.split(",") if o.strip()]]
        if self.environment == "development":
            from urllib.parse import urlsplit

            parsed = urlsplit(self.app_origin)
            if parsed.hostname in {"localhost", "127.0.0.1"} and parsed.scheme == "http":
                port = f":{parsed.port}" if parsed.port else ""
                origins.extend([f"http://localhost{port}", f"http://127.0.0.1{port}"])
        from urllib.parse import urlsplit

        for origin in origins:
            parsed = urlsplit(origin)
            if (
                not parsed.hostname
                or parsed.scheme not in {"http", "https"}
                or parsed.path
                or parsed.query
                or parsed.fragment
                or parsed.username
                or parsed.password
                or "*" in origin
            ):
                raise ValueError(
                    "Allowed origins must be exact HTTP(S) origins without paths, credentials or wildcards."
                )
            if self.environment == "production" and parsed.scheme != "https":
                raise ValueError("Production origins require HTTPS.")
        return list(dict.fromkeys(origins))


settings = Settings()
