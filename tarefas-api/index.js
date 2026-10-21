import express from "express";

const app = express();

app.use(express.json());

app.get("/api/saude", (req, res) => {
    res.json({ mensagem: "API de tarefas funcionando!" });
});

app.listen(3001, () => {
    console.log("Servidor em http://localhost:3001");
});