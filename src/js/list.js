const { ipcRenderer } = require("electron");

const params = new URLSearchParams(window.location.search);
const id = params.get('id');

const modalTitle = document.getElementById("list-modal-title");
const nameInput = document.getElementById("list-name-input");
const descInput = document.getElementById("list-description-input");
const saveBtn = document.getElementById("list-modal-save");
const cancelBtn = document.getElementById("list-modal-cancel");
const deleteBtn = document.getElementById("list-modal-delete");

let currentEditingList = null;

window.onload = async () => {
  if (id) {
    const list = await ipcRenderer.invoke("getListById", parseInt(id));
    currentEditingList = list;
    modalTitle.textContent = "Edit List";
    nameInput.value = list.NOME;
    descInput.value = list.DESCRICAO || "";
    deleteBtn.classList.remove("hidden");
  } else {
    modalTitle.textContent = "New List";
    deleteBtn.classList.add("hidden");
  }
};

saveBtn.onclick = async () => {
  const name = nameInput.value.trim();
  const desc = descInput.value.trim();

  if (!name) return alert("Name is required.");

  if (currentEditingList) {
    await ipcRenderer.invoke('updateList', {
      ...currentEditingList,
      nome: name,
      descricao: desc
    });
  } else {
    await ipcRenderer.invoke('addList', {
      nome: name,
      descricao: desc,
      oculto: false
    });
  }
  ipcRenderer.send('lists-updated'); // sinaliza para a janela principal atualizar
  window.close();
};

cancelBtn.onclick = () => window.close();

deleteBtn.onclick = async () => {
  if (confirm("Do you really want to delete this list and its linked tasks?")) {
    await ipcRenderer.invoke("deleteList", currentEditingList.IDLISTA);
    ipcRenderer.send('lists-updated');
    window.close();
  }
};
