import {
    getTodos,
    createTodo,
    toggleTodo,
    deleteTodo,
    getStats
} from "./todoService.js";

const form = document.getElementById("todoForm");
const todoList = document.getElementById("todoList");
const totalSpan = document.getElementById("total");
const completedSpan = document.getElementById("completed");

async function renderTodos() {
    const todos = await getTodos();
    todoList.innerHTML = "";

    todos.forEach(todo => {
        const li = document.createElement("li");
        if (todo.completed) li.classList.add("completed");

        li.innerHTML = `
            <span>${todo.title}</span>
            <div class="actions">
                <button class="btn-complete">✔</button>
                <button class="btn-delete">✖</button>
            </div>
        `;

        li.querySelector(".btn-complete")
            .addEventListener("click", async () => {
                await toggleTodo(todo.id);
                refresh();
            });

        li.querySelector(".btn-delete")
            .addEventListener("click", async () => {
                await deleteTodo(todo.id);
                refresh();
            });

        todoList.appendChild(li);
    });
}

async function renderStats() {
    const stats = await getStats();
    totalSpan.textContent = stats.totalTodos;
    completedSpan.textContent = stats.completed;
}

async function refresh() {
    await renderTodos();
    await renderStats();
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("title").value;
    const description = document.getElementById("description").value;

    await createTodo({ title, description });

    form.reset();
    refresh();
});

refresh();