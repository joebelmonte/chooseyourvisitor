import { glanceSessionEventListeners } from "./eventListeners.js";
import { refreshConfigs, addTheScript } from "./loadTheScript.js";

function createAdditionalGroupStartButtons() {
  const additionalGroupIds = document
    .querySelector("#additionalGroupIds")
    .value.split(",");
  if (additionalGroupIds != "") {
    additionalGroupIds.forEach((groupId) => {
      document
        .querySelector("#additional-group-start-buttons")
        .insertAdjacentHTML(
          "beforeend",
          `<button id="start-session-${groupId}" data-additional-group="${groupId}">
      Start Session with Group ${groupId}
    </button>`
        );
      document
        .querySelector(`#start-session-${groupId}`)
        .addEventListener("click", (e) => {
          GLANCE.Cobrowse.Visitor.startSession({
            groupid: `${groupId}`,
            sessionKey: "GLANCE_KEYTYPE_RANDOM",
          });
        });
    });
  }
}

function submitClicked() {
  console.log("submit button clicked at ", Date());
  createAdditionalGroupStartButtons();
  addTheScript();
  document.getElementById("glance-cobrowse").onload = (event) => {
    glanceSessionEventListeners();
  };
  document.getElementById("user-input").classList.add("fancy-border");
  document.getElementById("change-visitor-id").style.display = "inline";
}

function pauseSession() {
  const url = new URL(window.location);
  if (!GLANCE.Cobrowse.Visitor.isSessionPaused()) {
    var params = {
      pause: true,
      message: document.querySelector("#pause-session-message").value,
    };
    GLANCE.Cobrowse.Visitor.pauseSession(params);
    document.querySelector("#pause-session-button").innerText =
      "Unpause Session";
    document.getElementById("paused-message").style.display = "block";
    url.searchParams.set("paused", "true");
    window.history.pushState({}, "", url);
  } else {
    GLANCE.Cobrowse.Visitor.pauseSession({ pause: false });
    document.querySelector("#pause-session-button").innerText = "Pause Session";
    document.getElementById("paused-message").style.display = "none";
    url.searchParams.set("paused", "false");
    window.history.pushState({}, "", url);
  }
}

// Automatically fill in the cdn value based on the website

var defineCdn = function () {
  var websiteSelection = document.getElementById("website").value;
  switch (websiteSelection) {
    case "www.glance.net":
      document.getElementById("cdn").value = "www.glancecdn.net";
      break;
    case "beta.glance.net":
      document.getElementById("cdn").value = "beta.glancecdn.net";
      break;
    case "www.myglance.net":
      document.getElementById("cdn").value = "cdn.myglance.net";
      break;
    case "dw1.myglance.org":
      document.getElementById("cdn").value = "cdn1.myglance.org";
      break;
    case "dw2.myglance.org":
      document.getElementById("cdn").value = "cdn2.myglance.org";
      break;
    case "dw3.myglance.org":
      document.getElementById("cdn").value = "cdn3.myglance.org";
      break;
    case "dw4.myglance.org":
      document.getElementById("cdn").value = "cdn4.myglance.org";
      break;
    default:
      document.getElementById("cdn").value = "";
      break;
  }
};

window.addEventListener("DOMContentLoaded", (event) => {
  console.log("DOM fully loaded and parsed");

  // Reset link

  document.getElementById("reset").addEventListener("click", () => {
    document.location = document.location.pathname;
  });

  document.getElementById("website").addEventListener("change", defineCdn);

  document
    .getElementById("submit-button")
    .addEventListener("click", submitClicked);

  // Get the configs from the URL if they exist
  // Then set the configs on the page based on the url
  try {
    var urlParamsString = decodeURIComponent(window.location.search.slice(1));
    if (urlParamsString.length > 0) {
      var configurations = JSON.parse(urlParamsString);
      document.querySelectorAll(".config").forEach(function (configElement) {
        configElement.value = configurations[configElement.dataset.configName];
      });
      if (configurations.autoLoad == "yes") {
        submitClicked();
      }
    }
  } catch (error) {
    console.log("Error setting configs based on url: ", error);
  }

  document
    .querySelector("#pause-session-button")
    .addEventListener("click", (event) => {
      console.log("session pause button clicked.");
      pauseSession();
    });

  document
    .querySelector("#change-visitor-id")
    .addEventListener("click", (event) => {
      if (typeof GLANCE.Presence.Visitor.setVisitorId === "function") {
        var newVisitorId = prompt("Enter new visitor id.");
        GLANCE.Presence.Visitor.setVisitorId(newVisitorId);
        document.getElementById("visitorId").value = newVisitorId;
        refreshConfigs();
      } else {
        alert("Only available on cobrowse version 5.4+.");
      }
    });

  document.querySelectorAll(".always-enabled").forEach(function (element) {
    element.addEventListener("change", (event) => {
      // If the user changes this setting before clicking submit, we don't want to disable the other settings
      refreshConfigs(true);
    });
  });
});
