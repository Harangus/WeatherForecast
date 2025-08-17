class ColorModeSwitcher {
    constructor(btnId) {
        this.btn = document.getElementById(btnId);
        this.html = document.documentElement;
        this.init();
    }

    init() {
        if (!localStorage.getItem("theme")) {
            this.html.classList.add("dark");
        } else {
            this.html.classList.add(localStorage.getItem("theme"));
        }

        this.btn.addEventListener("click", () => {
            if (this.html.classList.contains("light")) {
                this.html.classList.replace("light", "dark");
                localStorage.setItem("theme", "dark");
            } else {
                this.html.classList.replace("dark", "light");
                localStorage.setItem("theme", "light");
            }
        });
    }
}

const colorModeSwitcher = new ColorModeSwitcher("toggle-theme");