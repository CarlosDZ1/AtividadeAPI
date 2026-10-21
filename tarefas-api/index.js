import "dotenv/config";
import express from "express";
import prisma from "./banco.js";
import { gerarHash, verificarSenha } from "./senhas.js";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "node:url";

const app = express();

app.use(express.json());

app.use(
    express.static(
        fileURLToPath(new URL("../frontend/frontend/", import.meta.url))
    )
);

const JWT_SECRET = process.env.JWT_SECRET;
const LOGS_URL = process.env.LOGS_URL;
const LOGS_CHAVE = process.env.SERVICO_LOGS_CHAVE;

if (!JWT_SECRET || !LOGS_URL || !LOGS_CHAVE) {
    throw new Error(
        "Configure JWT_SECRET, LOGS_URL e SERVICO_LOGS_CHAVE no .env."
    );
}

// Enviar logs ao Laravel.
async function registrarLog(acao, detalhe, usuarioId = null) {
    try {
        const resposta = await fetch(LOGS_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "X-Service-Key": LOGS_CHAVE,
            },
            body: JSON.stringify({ acao, detalhe, usuarioId }),
            signal: AbortSignal.timeout(3000),
        });

        if (!resposta.ok) {
            throw new Error(`Servico de logs retornou ${resposta.status}`);
        }
    } catch (erro) {
        console.error("Falha ao registrar log:", erro.message);
    }
}

// Validar token.
async function autenticar(req, res, next) {
    const partes = (req.headers.authorization ?? "").trim().split(/\s+/);

    try {
        if (
            partes.length !== 2 ||
            partes[0].toLowerCase() !== "bearer"
        ) {
            throw new Error("Token ausente.");
        }

        const dados = jwt.verify(partes[1], JWT_SECRET, {
            algorithms: ["HS256"],
            issuer: "tarefas-api",
            audience: "atividade-api",
        });

        const usuarioId = Number(dados.sub);

        if (
            !Number.isSafeInteger(usuarioId) ||
            usuarioId < 1 ||
            !Number.isFinite(dados.exp)
        ) {
            throw new Error("Token invalido.");
        }

        req.usuarioId = usuarioId;
    } catch {
        await registrarLog(
            "ACESSO_INDEVIDO",
            `Requisicao sem token valido: ${req.method} ${req.path}`
        );

        return res.status(401).json({
            mensagem: "Token ausente, invalido ou expirado.",
        });
    }

    return next();
}

// Validar identificador da tarefa.
function identificarTarefa(req, res, next) {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(422).json({
            mensagem: "Identificador de tarefa invalido.",
        });
    }

    req.tarefaId = id;
    return next();
}

// Verificar funcionamento.
app.get("/api/saude", (req, res) => {
    res.json({ mensagem: "API de tarefas funcionando!" });
});

// Cadastro.
app.post("/api/cadastro", async (req, res) => {
    const { nome, email, senha } = req.body ?? {};

    if (
        typeof nome !== "string" ||
        typeof email !== "string" ||
        typeof senha !== "string"
    ) {
        return res.status(422).json({
            mensagem: "Nome, email e senha devem ser informados como texto.",
        });
    }

    const nomeTratado = nome.trim();
    const emailTratado = email.trim().toLowerCase();

    if (nomeTratado === "" || emailTratado === "") {
        return res.status(422).json({
            mensagem: "Nome e email nao podem estar vazios.",
        });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTratado)) {
        return res.status(422).json({
            mensagem: "Informe um email valido.",
        });
    }

    if (senha.length < 8) {
        return res.status(422).json({
            mensagem: "A senha deve ter pelo menos 8 caracteres.",
        });
    }

    try {
        const existente = await prisma.usuario.findUnique({
            where: { email: emailTratado },
        });

        if (existente) {
            return res.status(409).json({
                mensagem: "Ja existe um usuario com esse email.",
            });
        }

        const senhaHash = await gerarHash(senha);

        const usuario = await prisma.usuario.create({
            data: {
                nome: nomeTratado,
                email: emailTratado,
                senha: senhaHash,
            },
            select: { id: true, nome: true, email: true },
        });

        await registrarLog(
            "USUARIO_CRIADO",
            "Novo usuario cadastrado.",
            usuario.id
        );

        return res.status(201).json({ data: usuario });
    } catch (erro) {
        if (erro.code === "P2002") {
            return res.status(409).json({
                mensagem: "Ja existe um usuario com esse email.",
            });
        }

        console.error("Erro no cadastro:", erro);
        await registrarLog("ERRO", "Falha no cadastro de usuario.");

        return res.status(500).json({
            mensagem: "Nao foi possivel cadastrar o usuario.",
        });
    }
});

// Login.
app.post("/api/login", async (req, res) => {
    const { email, senha } = req.body ?? {};

    if (
        typeof email !== "string" ||
        typeof senha !== "string" ||
        email.trim() === "" ||
        senha === ""
    ) {
        return res.status(422).json({
            mensagem: "Informe email e senha.",
        });
    }

    try {
        const usuario = await prisma.usuario.findUnique({
            where: { email: email.trim().toLowerCase() },
        });

        const senhaCorreta = usuario
            ? await verificarSenha(senha, usuario.senha)
            : false;

        if (!usuario || !senhaCorreta) {
            await registrarLog(
                "ACESSO_INDEVIDO",
                "Tentativa de login com credenciais invalidas."
            );

            return res.status(401).json({
                mensagem: "Email ou senha invalidos.",
            });
        }

        const token = jwt.sign({}, JWT_SECRET, {
            algorithm: "HS256",
            subject: String(usuario.id),
            expiresIn: "2h",
            issuer: "tarefas-api",
            audience: "atividade-api",
        });

        return res.json({
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
            },
        });
    } catch (erro) {
        console.error("Erro no login:", erro);
        await registrarLog("ERRO", "Falha ao realizar login.");

        return res.status(500).json({
            mensagem: "Nao foi possivel realizar o login.",
        });
    }
});

// Listar tarefas do usuario.
app.get("/api/todos", autenticar, async (req, res) => {
    try {
        const tarefas = await prisma.tarefa.findMany({
            where: { usuarioId: req.usuarioId },
            orderBy: { id: "desc" },
        });

        return res.json({ data: tarefas });
    } catch (erro) {
        console.error(erro);
        await registrarLog("ERRO", "Falha ao listar tarefas.", req.usuarioId);

        return res.status(500).json({
            mensagem: "Nao foi possivel listar as tarefas.",
        });
    }
});

// Criar tarefa.
app.post("/api/todos", autenticar, async (req, res) => {
    const { titulo } = req.body ?? {};

    if (
        typeof titulo !== "string" ||
        titulo.trim() === "" ||
        titulo.trim().length > 255
    ) {
        return res.status(422).json({
            mensagem: "Informe um titulo entre 1 e 255 caracteres.",
        });
    }

    try {
        const tarefa = await prisma.tarefa.create({
            data: {
                titulo: titulo.trim(),
                usuarioId: req.usuarioId,
            },
        });

        await registrarLog(
            "TAREFA_CRIADA",
            `Tarefa ${tarefa.id} criada.`,
            req.usuarioId
        );

        return res.status(201).json({ data: tarefa });
    } catch (erro) {
        console.error(erro);
        await registrarLog("ERRO", "Falha ao criar tarefa.", req.usuarioId);

        return res.status(500).json({
            mensagem: "Nao foi possivel criar a tarefa.",
        });
    }
});

// Concluir ou reabrir tarefa.
app.put(
    "/api/todos/:id",
    autenticar,
    identificarTarefa,
    async (req, res) => {
        const { concluida } = req.body ?? {};

        if (typeof concluida !== "boolean") {
            return res.status(422).json({
                mensagem: "concluida deve ser true ou false.",
            });
        }

        try {
            const resultado = await prisma.tarefa.updateMany({
                where: {
                    id: req.tarefaId,
                    usuarioId: req.usuarioId,
                },
                data: { concluida },
            });

            if (resultado.count === 0) {
                await registrarLog(
                    "ACESSO_INDEVIDO",
                    `Tentativa de alterar tarefa ${req.tarefaId} inexistente ou de outro usuario.`,
                    req.usuarioId
                );

                return res.status(404).json({
                    mensagem: "Tarefa nao encontrada.",
                });
            }

            await registrarLog(
                concluida ? "TAREFA_CONCLUIDA" : "TAREFA_REABERTA",
                `Tarefa ${req.tarefaId} atualizada.`,
                req.usuarioId
            );

            return res.json({
                data: { id: req.tarefaId, concluida },
            });
        } catch (erro) {
            console.error(erro);
            await registrarLog(
                "ERRO",
                "Falha ao atualizar tarefa.",
                req.usuarioId
            );

            return res.status(500).json({
                mensagem: "Nao foi possivel atualizar a tarefa.",
            });
        }
    }
);

// Excluir tarefa.
app.delete(
    "/api/todos/:id",
    autenticar,
    identificarTarefa,
    async (req, res) => {
        try {
            const resultado = await prisma.tarefa.deleteMany({
                where: {
                    id: req.tarefaId,
                    usuarioId: req.usuarioId,
                },
            });

            if (resultado.count === 0) {
                await registrarLog(
                    "ACESSO_INDEVIDO",
                    `Tentativa de excluir tarefa ${req.tarefaId} inexistente ou de outro usuario.`,
                    req.usuarioId
                );

                return res.status(404).json({
                    mensagem: "Tarefa nao encontrada.",
                });
            }

            await registrarLog(
                "TAREFA_EXCLUIDA",
                `Tarefa ${req.tarefaId} excluida.`,
                req.usuarioId
            );

            return res.status(204).send();
        } catch (erro) {
            console.error(erro);
            await registrarLog(
                "ERRO",
                "Falha ao excluir tarefa.",
                req.usuarioId
            );

            return res.status(500).json({
                mensagem: "Nao foi possivel excluir a tarefa.",
            });
        }
    }
);

// Consultar estatisticas no FastAPI.
app.get("/api/stats", autenticar, async (req, res) => {
    try {
        const resposta = await fetch(
            "http://127.0.0.1:8001/api/stats",
            {
                headers: {
                    Authorization: req.headers.authorization,
                    Accept: "application/json",
                },
                signal: AbortSignal.timeout(5000),
            }
        );

        const dados = await resposta.json();
        return res.status(resposta.status).json(dados);
    } catch (erro) {
        console.error("Erro na integracao com estatisticas:", erro);

        await registrarLog(
            "ERRO",
            "Falha na comunicacao com a API de estatisticas.",
            req.usuarioId
        );

        return res.status(502).json({
            mensagem: "Servico de estatisticas indisponivel.",
        });
    }
});

// Responder com JSON quando uma rota de API nao existir.
app.use("/api", (req, res) => {
    res.status(404).json({
        mensagem: "Rota nao encontrada.",
    });
});

// Tratar JSON malformado e erros inesperados.
app.use((erro, req, res, next) => {
    if (res.headersSent) {
        return next(erro);
    }

    if (erro.type === "entity.parse.failed") {
        return res.status(400).json({
            mensagem: "Corpo JSON invalido.",
        });
    }

    console.error("Erro inesperado:", erro);

    return res.status(500).json({
        mensagem: "Erro interno no servidor.",
    });
});

app.listen(3001, () => {
    console.log("Aplicacao em http://127.0.0.1:3001");
});