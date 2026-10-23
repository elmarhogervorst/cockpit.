/* Setzt Hell/Dunkel vor dem ersten Zeichnen, damit die Seite nicht aufblitzt. Die Wahl wird pro Gerät gespeichert. */
try{var t=localStorage.getItem('cockpit.theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':t==='auto'?'':'light');if(t==='auto')document.documentElement.removeAttribute('data-theme');}catch(e){document.documentElement.setAttribute('data-theme','light');}
