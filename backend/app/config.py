from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    cors_origins: str = "*"

    # Lets the app's crash-report prompt file a GitHub issue on the user's
    # behalf without ever shipping a GitHub credential in the app itself.
    # Unset until an operator configures both - see github_service.py.
    github_token: str | None = None
    github_repo: str | None = None  # "owner/repo"

    # Shared secret the app sends as X-App-Secret on /api/support/report -
    # baked into the app build (not a per-user credential), so it only stops
    # opportunistic abuse from someone hitting the URL directly, not a
    # determined attacker who decompiles the APK. Unset disables the check
    # entirely (local dev only - see support.py).
    app_shared_secret: str | None = None

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
