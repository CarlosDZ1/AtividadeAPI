import { gerarHash, verificarSenha } from "./senhas.js";

const senha = "MinhaSenha123";
const valorSalvo = await gerarHash(senha);

const resultadoCorreto = await verificarSenha(senha, valorSalvo);
const resultadoIncorreto = await verificarSenha("outraSenha", valorSalvo);

console.log("Senha correta:", resultadoCorreto);
console.log("Senha incorreta:", resultadoIncorreto);