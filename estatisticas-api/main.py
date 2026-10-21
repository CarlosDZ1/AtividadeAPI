import json
import logging
import os
from pathlib import Path
from urllib.request import Request, urlopen

import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import Boolean, Integer, create_engine, func, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

PASTA = Path(__file__).resolve().parent
load_dotenv(PASTA / ".env")

JWT_SECRET = os.getenv("JWT_SECRET")
LOGS_URL = os.getenv("LOGS_URL")
LOGS_CHAVE = os.getenv("SERVICO_LOGS_CHAVE")

if not all([JWT_SECRET, LOGS_URL, LOGS_CHAVE]):
    raise RuntimeError(
        "Configure JWT_SECRET, LOGS_URL e SERVICO_LOGS_CHAVE no .env."
    )

caminho_banco = (
    PASTA / os.getenv("BANCO_TAREFAS", "../tarefas-api/dev.db")
).resolve()

if not caminho_banco.is_file():
    raise RuntimeError(f"Banco nao encontrado: {caminho_banco}")

engine = create_engine(
    f"sqlite:///{caminho_banco.as_uri()}?mode=ro&uri=true",
    connect_args={"check_same_thread": False},
)


class Base(DeclarativeBase):
    pass


class Tarefa(Base):
    __tablename__ = "Tarefa"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    usuarioId: Mapped[int] = mapped_column(Integer)
    concluida: Mapped[bool] = mapped_column(Boolean)


app = FastAPI(title="API de Estatisticas")
seguranca = HTTPBearer(auto_error=False)


def registrar_log(acao, detalhe, usuario_id=None):
    dados = json.dumps({
        "acao": acao,
        "detalhe": detalhe,
        "usuarioId": usuario_id,
    }).encode("utf-8")

    requisicao = Request(
        LOGS_URL,
        data=dados,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Service-Key": LOGS_CHAVE,
        },
    )

    try:
        with urlopen(requisicao, timeout=3):
            pass
    except Exception:
        logging.exception("Falha ao enviar log para o Laravel.")


def usuario_autenticado(
    credencial: HTTPAuthorizationCredentials | None = Depends(seguranca),
) -> int:
    try:
        if credencial is None or credencial.scheme.lower() != "bearer":
            raise ValueError("Token ausente.")

        dados = jwt.decode(
            credencial.credentials,
            JWT_SECRET,
            algorithms=["HS256"],
            issuer="tarefas-api",
            audience="atividade-api",
            options={"require": ["exp", "sub", "iss", "aud"]},
        )

        usuario_id = int(dados["sub"])

        if usuario_id < 1:
            raise ValueError("Usuario invalido.")

        return usuario_id

    except (jwt.InvalidTokenError, ValueError, TypeError):
        registrar_log(
            "ACESSO_INDEVIDO",
            "Tentativa de consultar estatisticas sem token valido.",
        )

        raise HTTPException(
            status_code=401,
            detail="Token ausente, invalido ou expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )


@app.get("/api/saude")
def saude():
    return {"mensagem": "API de estatisticas funcionando!"}


@app.get("/api/stats")
def estatisticas(usuario_id: int = Depends(usuario_autenticado)):
    try:
        with Session(engine) as sessao:
            consulta = (
                select(Tarefa.concluida, func.count(Tarefa.id))
                .where(Tarefa.usuarioId == usuario_id)
                .group_by(Tarefa.concluida)
            )

            contagens = dict(sessao.execute(consulta).all())

            concluidas = contagens.get(True, 0)
            pendentes = contagens.get(False, 0)

            return {
                "usuarioId": usuario_id,
                "total": concluidas + pendentes,
                "concluidas": concluidas,
                "pendentes": pendentes,
            }

    except Exception:
        logging.exception("Erro ao consultar estatisticas.")

        registrar_log(
            "ERRO",
            "Falha ao consultar estatisticas.",
            usuario_id,
        )

        raise HTTPException(
            status_code=500,
            detail="Nao foi possivel consultar as estatisticas.",
        )