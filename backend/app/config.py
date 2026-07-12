from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    adb_path: str = "adb"
    workspace_dir: Path = Path("./workspace")
    models_dir: Path = Path("./workspace/models")
    log_file: Path = Path("./logs/pocketcoder.log")
    db_path: Path = Path("./pocketcoder.db")
    device_serial: str = ""
    log_level: str = "INFO"
    cors_origins: str = "*"

    remote_workspace: str = "/data/local/tmp/pocketcoder"
    remote_llama_dir: str = "~/llama.cpp"
    remote_download_dir: str = "/sdcard/Download"
    llama_server_port: int = 8080
    llama_context_size: int = 2048

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
settings.workspace_dir.mkdir(parents=True, exist_ok=True)
settings.models_dir.mkdir(parents=True, exist_ok=True)
settings.log_file.parent.mkdir(parents=True, exist_ok=True)
