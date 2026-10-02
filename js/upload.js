// Upload round (Design and Redesign). Screens are kept per day and round.
// Each round's markup is a [data-upload="<round>"] element; parts are found
// by data-el so both rounds can share this code on one page.
(function () {
  document.querySelectorAll("[data-upload]").forEach(setup);

  function setup(root) {
    const round = root.dataset.upload;
    const storeKey = window.DTCStore.key(round);
    const challenge = window.DTC.today();

    const $ = (name) => root.querySelector('[data-el="' + name + '"]');
    const canvas = $("canvas");
    const dropzone = $("dropzone");
    const list = $("screens");
    const fileInput = $("file");
    const count = $("count");
    const clearBtn = $("clear");
    const continueBtn = $("continue");
    const intent = $("intent");

    $("challenge-label").textContent = "Your challenge · " + String(challenge.id).padStart(3, "0");
    $("challenge-brief").textContent = challenge.brief;

    let screens = []; // { id, name, blob, url }
    let saveTimer = null;

    function save() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        window.DTCStore.set(storeKey, {
          challengeId: challenge.id,
          intent: intent.value,
          size: canvas.dataset.size,
          screens: screens.map(({ id, name, blob }) => ({ id, name, blob })),
        });
      }, 150);
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
      clearBtn.disabled = !has;
      continueBtn.classList.toggle("is-disabled", !has);
      continueBtn.setAttribute("aria-disabled", String(!has));
      count.textContent = has
        ? screens.length + (screens.length === 1 ? " screen" : " screens")
        : "No screens yet";
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
      render();
      save();
    }

    function removeScreen(id) {
      const screen = screens.find((s) => s.id === id);
      if (screen) URL.revokeObjectURL(screen.url);
      screens = screens.filter((s) => s.id !== id);
      render();
      save();
    }

    // Clear asks for a second click instead of a confirm() dialog.
    let clearArmed = false;
    clearBtn.addEventListener("click", () => {
      if (!clearArmed) {
        clearArmed = true;
        clearBtn.textContent = "Click again to clear";
        setTimeout(() => {
          clearArmed = false;
          clearBtn.textContent = "Clear";
        }, 2500);
        return;
      }
      clearArmed = false;
      clearBtn.textContent = "Clear";
      screens.forEach((s) => URL.revokeObjectURL(s.url));
      screens = [];
      render();
      save();
    });

    continueBtn.addEventListener("click", (e) => {
      if (!screens.length) e.preventDefault();
    });

    $("add-images").addEventListener("click", () => fileInput.click());
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

    // Paste a frame copied from Figma (Copy as PNG).
    document.addEventListener("paste", (e) => {
      if (root.hidden || e.target === intent) return;
      const files = [...(e.clipboardData?.items || [])]
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter(Boolean);
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    });

    root.querySelectorAll("button[data-size]").forEach((btn) => {
      btn.addEventListener("click", () => setSize(btn.dataset.size));
    });
    function setSize(size) {
      canvas.dataset.size = size;
      root.querySelectorAll("button[data-size]").forEach((b) =>
        b.classList.toggle("is-active", b.dataset.size === size)
      );
      save();
    }

    intent.addEventListener("input", save);

    // Restore today's work.
    window.DTCStore.get(storeKey).then((saved) => {
      if (saved && saved.challengeId === challenge.id) {
        intent.value = saved.intent || "";
        if (saved.size) setSize(saved.size);
        screens = (saved.screens || []).map((s) => ({ ...s, url: URL.createObjectURL(s.blob) }));
      }
      render();
    });
  }
})();
