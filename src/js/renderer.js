const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');

const currentListBtn = document.getElementById('current-list');
const listDropdown = document.getElementById('list-dropdown');

const taskList = document.getElementById('todo-list');
const taskInput = document.getElementById('new-task');
const addTaskBtn = document.getElementById('add-task');

const configPath = path.join(__dirname, 'config.json');

let tasks = [];
let lists = [];
let selectedList = null;

async function loadLists() {
  console.log('[loadLists] Sending IPC to get lists...');
  ipcRenderer.invoke('getAllLists').then((result) => {
    lists = result;
    console.log('[loadLists] Lists loaded:', lists);

    if (lists.length === 0) {
      console.warn('[loadLists] No lists available.');
      return;
    }

    selectedList = lists[0];
    updateListSelector();
  }).catch((err) => {
    console.error('[loadLists] Failed to load lists:', err);
  });
}

function updateListSelector() {
  currentListBtn.textContent = selectedList.NOME;
  console.log('[updateListSelector] Selected list:', selectedList.NOME);

  listDropdown.innerHTML = '';

  lists.forEach((listItem) => {
    const li = document.createElement('li');
    li.textContent = listItem.NOME;
    li.onclick = () => {
      selectedList = listItem;
      console.log('[updateListSelector] Changed to:', listItem.NOME);
      listDropdown.classList.add('hidden');
      updateListSelector();
      loadTasks();
    };
    listDropdown.appendChild(li);
  });

  const newListOption = document.createElement('li');
  newListOption.textContent = '➕ New List';
  newListOption.onclick = () => {
    const name = prompt('New list name:');
    if (name) {
      console.log('[newListOption] Requesting new list:', name);
      ipcRenderer.invoke('addList', {
        nome: name,
        descricao: '',
        oculto: false
      }).then(() => {
        loadLists();
      });
    }
  };
  listDropdown.appendChild(newListOption);
}

currentListBtn.onclick = () => {
  listDropdown.classList.toggle('hidden');
  console.log('[currentListBtn] Toggled list dropdown');
};

function loadTasks() {
  console.log('[loadTasks] Reading from local config (JSON file)');
  try {
    const data = fs.readFileSync(configPath);
    tasks = JSON.parse(data);
    renderTasks();
  } catch (err) {
    console.warn('[loadTasks] No config or failed to parse:', err);
    tasks = [];
  }
}

function saveTasks() {
  fs.writeFileSync(configPath, JSON.stringify(tasks, null, 2));
  console.log('[saveTasks] Tasks saved to config.json');
}

function renderTasks() {
  taskList.innerHTML = '';
  console.log('[renderTasks] Rendering tasks:', tasks);

  tasks.forEach((task, index) => {
    const li = document.createElement('li');
    li.textContent = task;
    li.onclick = () => {
      console.log(`[renderTasks] Removing task at index ${index}`);
      tasks.splice(index, 1);
      saveTasks();
      renderTasks();
    };
    taskList.appendChild(li);
  });
}

addTaskBtn.onclick = () => {
  const task = taskInput.value.trim();
  if (task) {
    console.log('[addTaskBtn] Adding task:', task);
    tasks.push(task);
    taskInput.value = '';
    saveTasks();
    renderTasks();
  }
};

document.getElementById("closebtn").onclick = () => {
  console.log('[UI] Closing app');
  ipcRenderer.send("quit-app");
};

document.getElementById("minbtn").onclick = () => {
  console.log('[UI] Minimizing app');
  ipcRenderer.send("minimize-app");
};

loadLists(); // start loading lists on init
