import { API_CONFIG } from "./api.js";

/* ===========================
   TODOS - LARAVEL
=========================== */

export async function getTodos() {
    const response = await fetch(`${API_CONFIG.LARAVEL}/todos`);
    const result = await response.json();

    return result.data;
}

export async function createTodo(data) {
    const response = await fetch(`${API_CONFIG.LARAVEL}/todos`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    const todo = await response.json();

    const log = todo.data;

    // Registrar log no Express
    await createLog("CREATE", log.id, "Nova tarefa criada");

    return todo;
}

export async function toggleTodo(id) {

    // Primeiro buscar todo atual
    const todos = await getTodos();
    const todo = todos.find(t => t.id === id);

    const response = await fetch(`${API_CONFIG.LARAVEL}/todos/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            completed: !todo.completed
        })
    });

    const updated = await response.json();

    await createLog("UPDATE", id, "Tarefa alterada");

    return updated;
}

export async function deleteTodo(id) {

    await fetch(`${API_CONFIG.LARAVEL}/todos/${id}`, {
        method: "DELETE"
    });

    await createLog("DELETE", id, "Tarefa removida");
}


/* ===========================
   LOGS - EXPRESS
=========================== */

async function createLog(action, todoId, message) {
    await fetch(`${API_CONFIG.EXPRESS}/logs`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            action,
            todoId,
            message
        })
    });
}


/* ===========================
   STATS - FASTAPI
=========================== */

export async function getStats() {
    const response = await fetch(`${API_CONFIG.FASTAPI}/stats`);

    return await response.json();
}