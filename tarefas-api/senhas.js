import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
export async function gerarHash(senha) {
    const salt = randomBytes(16).toString("hex");

    const hash = await scryptAsync(senha, salt, 64);

    return `${salt}:${hash.toString("hex")}`;
}

export async function verificarSenha(senha, valorSalvo) {
    const [salt, hashSalvo] = valorSalvo.split(":");

    const hashCalculado = await scryptAsync(senha, salt, 64);
    const hashOriginal = Buffer.from(hashSalvo, "hex");

    return timingSafeEqual(hashCalculado, hashOriginal);
}