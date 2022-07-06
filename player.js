// dom
var interactive = document.getElementById("interactive");
var canvas = document.getElementById("canvas");
var overlay = document.getElementById("overlay");
var fullscreen = document.getElementById("fullscreen");
var modal = document.getElementById("modal");

class Player {
  constructor() {
    this.state = "pending";
    this.full = document.isFullscreen;
  }
  toggle() {
    if (this.full) {
      if (document.exitFullscreen)
        document.exitFullscreen();
      else if (document.webkitExitFullscreen)
        document.webkitExitFullscreen();
      else if (document.msExitFullscreen)
        document.msExitFullscreen();
      fullscreen.classList.add("gofullscreen");
      fullscreen.classList.remove("gowindowed");
    } else {
      if (interactive.requestFullscreen)
        interactive.requestFullscreen();
      else if (interactive.webkitRequestFullscreen)
        interactive.webkitRequestFullscreen();
      else if (interactive.msRequestFullscreen)
        interactive.msRequestFullscreen();
      fullscreen.classList.remove("gofullscreen");
      fullscreen.classList.add("gowindowed");
    }
    this.full = !this.full;
  }
  load(file, arg) {
    console.info(file, arg);
    this.state = "loading";
    modal.classList.add("loading");
    LoadModule(file, arg);
    interactive.focus();
  }
  error(msg) {
    console.log(msg);
    if (this.state != "failed") {
      if (this.state != "playing") {
        modal.classList.add("error");
        overlay.style.display = "block";
      }
      this.state = "failed";
    }
  }
  finished() {
    //if (this.state != "failed") {
      this.state = "playing";
      overlay.style.display = "none";
    //}
  }
}

// cookie consent
function getCookie(name) {
  name += "=";
  let decode = decodeURIComponent(document.cookie);
  let ca = decode.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == " ")
      c = c.substring(1);
    if (c.indexOf(name) == 0)
      return c.substring(name.length, c.length);
  }
}
function setCookie(name, value, seconds) {
  if (seconds == null)
    seconds = 60*60*24*365*10;
  const d = new Date();
  d.setTime(d.getTime() + (seconds*1000));
  let expires = "expires="+d.toUTCString();
  document.cookie = name+"="+value+";"+expires+";path=/";
}

function consentDialog() {
  if (player.state != "pending")
    return;
  if (getCookie("cookie_consent") != "true")
    if (!confirm("Allow access to local data storage?"))
      return;
  setCookie("cookie_consent", true);
  player.load(params.get("g") || "nogame.love", arg);
}

player = new Player();

window.alert = player.error.bind(player);
window.onerror = player.error.bind(player);
window.onload = window.focus.bind(window);
window.onclick = function() {
  window.focus();
  consentDialog();
};
const prevent = [37, 38, 39, 40, 13];
window.addEventListener("keydown", function(e) {
  if (prevent.indexOf(e.keyCode) > -1)
    e.preventDefault();
  if (e.keyCode != 27)
    consentDialog();
}, false);


// fetch arguments from url
var url = new URL(window.location.href);
var params = url.searchParams;
let mem = params.get("m");
if (mem && parseInt(mem))
  Module.INITIAL_MEMORY = parseInt(mem)*1e+6;
var arg = params.get("arg");
if (arg) {
  try {
    arg = JSON.parse(arg);
    if (!Array.isArray(arg))
      arg = [arg];
  } catch(error) {
    arg = null;
    console.log(error);
  }
}

Module.canvas = canvas;
Module.printErr = player.error.bind(player);
Module.loadingComplete = player.finished.bind(player);

if (parseInt(params.get("f")) == 1)
  fullscreen.style.display = "block";

let ver = "release";
if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
  ver = "compat";
  console.info("compatibility mode");
}

var s = document.createElement("script");
s.type = "text/javascript";
s.src = ver+"/love.js";
s.async = true;
s.onload = consentDialog;
document.body.appendChild(s);