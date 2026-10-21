const elemento = (id) => document.getElementById(id);

let token = sessionStorage.getItem("token");
let nomeUsuario = sessionStorage.getItem("nomeUsuario") ?? "";

function mensagem(texto = "") {
    elemento("mensagem").textContent = texto;
}

function atualizarTela() {
    elemento("autenticacao").hidden = Boolean(token);
    elemento("painel").hidden = !token;
    elemento("usuarioNome").textContent = `Olá, ${nomeUsuario}!`;
}

function sair() {
    token = null;
    nomeUsuario = "";
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("nomeUsuario");
    elemento("todoList").replaceChildren();

    for (const id of ["total", "completed", "pending"]) {
        elemento(id).textContent = "—";
    }

    atualizarTela();
}

async function requisicao(caminho, opcoes = {}, protegida = true) {
    const headers = { Accept: "application/json" };

    if (opcoes.body !== undefined) {
        headers["Content-Type"] = "application/json";
    }

    if (protegida && token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const resposta = await fetch(`/api${caminho}`, {
        ...opcoes,
        headers,
    });

    const dados = resposta.status === 204
        ? null
        : await resposta.json();

    if (!resposta.ok) {
        if (resposta.status === 401 && protegida) {
            sair();
        }

        throw new Error(
            dados?.mensagem ??
            dados?.detail ??
            "Não foi possível concluir a operação."
        );
    }

    return dados;
}

async function executar(botao, acao) {
    mensagem();
    botao.disabled = true;

    try {
        await acao();
    } catch (erro) {
        mensagem(erro.message);
    } finally {
        botao.disabled = false;
    }
}

async function carregarTarefas() {
    const resultado = await requisicao("/todos");
    const lista = elemento("todoList");
    lista.replaceChildren();

    if (resultado.data.length === 0) {
        const item = document.createElement("li");
        item.textContent = "Você ainda não tem tarefas.";
        lista.appendChild(item);
        return;
    }

    for (const tarefa of resultado.data) {
        const item = document.createElement("li");

        const titulo = document.createElement("span");
        titulo.className = "titulo-tarefa";
        titulo.textContent = tarefa.titulo;

        if (tarefa.concluida) {
            titulo.classList.add("completed");
        }

        const acoes = document.createElement("div");
        acoes.className = "actions";

        const concluir = document.createElement("button");
        concluir.type = "button";
        concluir.className = "btn-complete";
        concluir.textContent = tarefa.concluida ? "Reabrir" : "Concluir";

        concluir.addEventListener("click", () => {
            executar(concluir, async () => {
                await requisicao(`/todos/${tarefa.id}`, {
                    method: "PUT",
                    body: JSON.stringify({
                        concluida: !tarefa.concluida,
                    }),
                });

                await atualizarDados();
            });
        });

        const excluir = document.createElement("button");
        excluir.type = "button";
        excluir.className = "btn-delete";
        excluir.textContent = "Excluir";

        excluir.addEventListener("click", () => {
            executar(excluir, async () => {
                await requisicao(`/todos/${tarefa.id}`, {
                    method: "DELETE",
                });

                await atualizarDados();
            });
        });

        acoes.append(concluir, excluir);
        item.append(titulo, acoes);
        lista.appendChild(item);
    }
}

async function atualizarDados() {
    await carregarTarefas();

    for (const id of ["total", "completed", "pending"]) {
        elemento(id).textContent = "—";
    }

    const stats = await requisicao("/stats");

    elemento("total").textContent = stats.total;
    elemento("completed").textContent = stats.concluidas;
    elemento("pending").textContent = stats.pendentes;
}

elemento("loginForm").addEventListener("submit", (evento) => {
    evento.preventDefault();
    const botao = evento.currentTarget.querySelector("button");

    executar(botao, async () => {
        const dados = await requisicao("/login", {
            method: "POST",
            body: JSON.stringify({
                email: elemento("loginEmail").value,
                senha: elemento("loginSenha").value,
            }),
        }, false);

        token = dados.token;
        nomeUsuario = dados.usuario.nome;

        sessionStorage.setItem("token", token);
        sessionStorage.setItem("nomeUsuario", nomeUsuario);

        elemento("loginForm").reset();
        atualizarTela();
        await atualizarDados();
    });
});

elemento("cadastroForm").addEventListener("submit", (evento) => {
    evento.preventDefault();
    const botao = evento.currentTarget.querySelector("button");

    executar(botao, async () => {
        const email = elemento("cadastroEmail").value;

        await requisicao("/cadastro", {
            method: "POST",
            body: JSON.stringify({
                nome: elemento("cadastroNome").value,
                email,
                senha: elemento("cadastroSenha").value,
            }),
        }, false);

        elemento("cadastroForm").reset();
        elemento("loginEmail").value = email;
        elemento("loginSenha").focus();
        mensagem("Conta criada! Entre com seu email e senha.");
    });
});

elemento("todoForm").addEventListener("submit", (evento) => {
    evento.preventDefault();
    const botao = evento.currentTarget.querySelector("button");

    executar(botao, async () => {
        await requisicao("/todos", {
            method: "POST",
            body: JSON.stringify({
                titulo: elemento("title").value,
            }),
        });

        elemento("todoForm").reset();
        await atualizarDados();
    });
});

elemento("sair").addEventListener("click", () => {
    sair();
    mensagem();
});

atualizarTela();

if (token) {
    atualizarDados().catch((erro) => mensagem(erro.message));
}