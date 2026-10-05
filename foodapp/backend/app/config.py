from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FOODAPP_", env_file=".env")

    # Локально SQLite, в проде: postgresql+psycopg://user:pass@host/db (сервер в РФ, 152-ФЗ)
    database_url: str = "sqlite:///./foodapp.db"


settings = Settings()
