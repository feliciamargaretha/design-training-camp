// An upload workspace: drop zone, screen cards, add and clear. Used once in
// Design and once per exploration in Redesign. Parts are found by data-el
// inside `root`; saving is left to the page through `onChange`.
(function () {
  function create(root, { screens: initial = [], onChange = () => {} } = {}) {
    const $ = (name) => root.querySelector('[data-el="' + name + '"]');
    const canvas = $("canvas");
    const dropzone = $("dropzone");
    const list = $("screens");
    const fileInput = $("file");
    const count = $("count");
    const clearBtn = $("clear");

    // { id, name, blob, url }
    let screens = initial.map((s) => ({ ...s, url: URL.createObjectURL(s.blob) }));

    function changed() {
      render();
      onChange(screens.map(({ id, name, blob }) => ({ id, name, blob })));
    }

    function render() {
      list.replaceChildren();
      screens.forEach((screen, i) => {
        const li = document.createElement("li");
        li.className = "screen";

        const card = document.createElement("div");
        card.className = "screen__card";
        const img = document.createElement("img");
        img.src = screen.url;
        img.alt = "Screen " + (i + 1) + ": " + screen.name;
        card.append(img);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "screen__remove";
        remove.setAttribute("aria-label", "Remove " + screen.name);
        remove.textContent = "×";
        remove.addEventListener("click", () => removeScreen(screen.id));
        card.append(remove);

        const caption = document.createElement("p");
        caption.className = "screen__caption";
        caption.innerHTML = "<span></span><span></span>";
        caption.children[0].textContent = String(i + 1).padStart(2, "0");
        caption.children[1].textContent = screen.name;

        li.append(card, caption);
        list.append(li);
      });

      if (screens.length) {
        const li = document.createElement("li");
        li.className = "screen screen--add";
        const add = document.createElement("button");
        add.type = "button";
        add.className = "screen__card screen__add";
        add.innerHTML = "<span aria-hidden=\"true\">+</span>Add screen";
        add.addEventListener("click", () => fileInput.click());
        li.append(add);
        list.append(li);
      }

      const has = screens.length > 0;
      dropzone.hidden = has;
      list.hidden = !has;
      if (clearBtn) clearBtn.disabled = !has;
      if (count) {
        count.textContent = has
          ? screens.length + (screens.length === 1 ? " screen" : " screens")
          : "No screens yet";
      }
    }

    function addFiles(files) {
      const images = [...files].filter((f) => f.type.startsWith("image/"));
      if (!images.length) return;
      images.forEach((file, i) => {
        screens.push({
          id: Date.now() + "-" + i + "-" + Math.random().toString(36).slice(2, 7),
          name: file.name && file.name !== "image.png" ? file.name : "Pasted screen.png",
          blob: file,
          url: URL.createObjectURL(file),
        });
      });
      changed();
    }

    function removeScreen(id) {
      const screen = screens.find((s) => s.id === id);
      if (screen) URL.revokeObjectURL(screen.url);
      screens = screens.filter((s) => s.id !== id);
      changed();
    }

    // Clear asks for a second click instead of a confirm() dialog.
    if (clearBtn) {
      let armed = false;
      clearBtn.addEventListener("click", () => {
        if (!armed) {
          armed = true;
          clearBtn.textContent = "Click again to clear";
          setTimeout(() => {
            armed = false;
            clearBtn.textContent = "Clear";
          }, 2500);
          return;
        }
        armed = false;
        clearBtn.textContent = "Clear";
        screens.forEach((s) => URL.revokeObjectURL(s.url));
        screens = [];
        changed();
      });
    }

    root.querySelectorAll('[data-el="add-images"]').forEach((btn) =>
      btn.addEventListener("click", () => fileInput.click())
    );
    dropzone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      addFiles(fileInput.files);
      fileInput.value = "";
    });

    // Drag and drop anywhere on the canvas.
    ["dragenter", "dragover"].forEach((type) =>
      canvas.addEventListener(type, (e) => {
        e.preventDefault();
        canvas.classList.add("is-dragging");
      })
    );
    ["dragleave", "drop"].forEach((type) =>
      canvas.addEventListener(type, (e) => {
        e.preventDefault();
        if (type === "dragleave" && canvas.contains(e.relatedTarget)) return;
        canvas.classList.remove("is-dragging");
      })
    );
    canvas.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

    render();

    return {
      addFiles,
      count: () => screens.length,
      destroy: () => screens.forEach((s) => URL.revokeObjectURL(s.url)),
    };
  }

  // Images on the clipboard (Figma's Copy as PNG), or [] if none.
  function pastedFiles(e) {
    return [...((e.clipboardData && e.clipboardData.items) || [])]
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter(Boolean);
  }

  // Preview size buttons ([data-size]) inside `root`, applied to `canvases()`.
  function sizeControl(root, canvases, onChange) {
    const buttons = [...root.querySelectorAll("button[data-size]")];
    let current = "m";
    function set(size, silent) {
      current = size;
      canvases().forEach((c) => (c.dataset.size = size));
      buttons.forEach((b) => b.classList.toggle("is-active", b.dataset.size === size));
      if (!silent) onChange(size);
    }
    buttons.forEach((b) => b.addEventListener("click", () => set(b.dataset.size)));
    return { set, get: () => current };
  }

  window.DTCWorkspace = { create, pastedFiles, sizeControl };
})();
