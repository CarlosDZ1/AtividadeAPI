import express from "express";
import prisma from "./banco.js";
const app = express();

app.use(express.json());

app.get("/api/saude", (req, res) => {
    res.json({ mensagem: "API de tarefas funcionando!" });
});
app.get("/api/teste-banco", async (req, res) => {
    try {
        const total = await prisma.usuario.count();

        res.json({ totalUsuarios: total });
    } catch (erro) {
        console.error(erro);

        res.status(500).json({
            mensagem: "Nao foi possivel consultar o banco.",
        });
    }
});
app.listen(3001, () => {
    console.log("Servidor em http://localhost:3001");
});