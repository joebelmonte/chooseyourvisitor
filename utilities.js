var buttonClicked = function (e) {
  e.preventDefault();
  document.getElementById("submit-masked").classList.toggle("green");
};

var buttonClicked2 = function (e) {
  e.preventDefault();
  document.getElementById("submit-not-masked").classList.toggle("green");
};

var buttonClickedSe = function (e) {
  e.preventDefault();
  document.getElementById("submit-masked-se").classList.toggle("green");
};

var buttonClicked2Se = function (e) {
  e.preventDefault();
  document.getElementById("submit-not-masked-se").classList.toggle("green");
};

var startSessionVideo = function (e) {
  var videoParam = e.target.getAttribute("data-video-type");
  if (videoParam) {
    var options = {
      video: videoParam,
      sessionKey: "GLANCE_KEYTYPE_RANDOM",
    };
    try {
      GLANCE.Cobrowse.Visitor.startSession(options);
    } catch (e) {
      alert("Script not loaded.");
    }
  }
};

document
  .getElementById("submit-masked")
  .addEventListener("click", buttonClicked);
document
  .getElementById("submit-not-masked")
  .addEventListener("click", buttonClicked2);
document
  .getElementById("submit-masked-se")
  .addEventListener("click", buttonClickedSe);
document
  .getElementById("submit-not-masked-se")
  .addEventListener("click", buttonClicked2Se);
document
  .getElementById("video-start-buttons")
  .addEventListener("click", (e) => {
    startSessionVideo(e);
  });

// Hot key
var map = {};
onkeydown = onkeyup = function (e) {
  e = e || event; // to deal with IE
  map[e.keyCode] = e.type == "keydown";
  if (map[16] && (map[8] || map[46])) {
    // shift is 16, backspace is 8, delete is 46
    GLANCE.Cobrowse.Visitor.showTerms({
      sessionKey: "GLANCE_KEYTYPE_RANDOM",
    });
  }
};

window.addEventListener("load", () => {
  console.log("this page loaded!");
  document.getElementById("share-user-screen").addEventListener("click", () => {
    GLANCE.Cobrowse.Visitor.showTerms({
      sessionKey: "GLANCE_KEYTYPE_RANDOM",
    });
  });
});

// Change backgroundcolor if on dev
if (window.location.href.includes("glancedev1.com/joeb/dev/")) {
  document.body.style.backgroundColor = "#7bed9f";
}

document.getElementById("pop-up").addEventListener("click", function () {
  let windowFeatures = "popup,left=-1000,top=500,width=600,height=600";
  const url = new URL(window.location);

  function openRequestedPopup() {
    windowObjectReference = window.open(url.href, "_blank", windowFeatures);
  }

  openRequestedPopup();
});

document
  .getElementById("start-session-with-loader")
  .addEventListener("click", startSessionWithLoader);

document.getElementById("start-the-session").addEventListener("click", () => {
  try {
    GLANCE.Cobrowse.Visitor.startSession("GLANCE_KEYTYPE_RANDOM");
  } catch (e) {
    alert("Script not loaded.");
  }
});

// Listen for cross domain events

window.addEventListener("message", (event) => {
  if (event.origin === "https://glancepro.online")
    console.log("Location of the opened window: ", event.data);
});
