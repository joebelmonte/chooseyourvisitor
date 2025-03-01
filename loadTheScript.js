function refreshConfigs(leaveEnabled) {
  // Grab the configs

  var configurations = {};
  document.querySelectorAll(".config").forEach(function (configElement) {
    configurations[configElement.dataset.configName] = configElement.value;
    // Exclude certain elements from being disabled:
    if (!leaveEnabled && !configElement.classList.contains("always-enabled")) {
      configElement.setAttribute("disabled", true);
    }
  });

  console.log("configurations is ", configurations);

  var urlParams = encodeURIComponent(JSON.stringify(configurations));

  //   Push the configs to the URL
  window.history.pushState({}, "", window.location.pathname + "?" + urlParams);

  return configurations;
}

function addTheScript() {
  var configurations = refreshConfigs();

  //   Set default website
  var dataWs = configurations.website
    ? configurations.website
    : "www.glance.net";

  // Construct the script tag based on the configs
  var theCobrowseScript = document.createElement("script");
  theCobrowseScript.setAttribute("id", "glance-cobrowse");
  theCobrowseScript.setAttribute("type", "text/javascript");
  theCobrowseScript.setAttribute("data-groupid", configurations.groupId);
  if (configurations.presenceSetting != "off") {
    theCobrowseScript.setAttribute(
      "data-presence",
      `${configurations.presenceSetting}`
    );
  }
  if (configurations.additionalGroupIds) {
    theCobrowseScript.setAttribute(
      "data-additionalgroupids",
      configurations.additionalGroupIds
    );
  }
  theCobrowseScript.setAttribute("data-site", `${configurations.environment}`);
  theCobrowseScript.setAttribute("charset", "UTF-8");
  theCobrowseScript.setAttribute("data-visitorid", configurations.visitorId);
  theCobrowseScript.setAttribute("data-ws", dataWs);
  theCobrowseScript.setAttribute(
    "data-startpaused",
    configurations.startPaused
  );
  if (configurations.videoAtStart != "default") {
    theCobrowseScript.setAttribute(
      "data-video",
      `${configurations.videoAtStart}`
    );
  }
  theCobrowseScript.setAttribute(
    "data-collection",
    configurations.dataCollection
  );
  if (configurations.selfHosted != "") {
    var version = configurations.selfHosted;
    var src = `./self-hosted-scripts/version_${version}/cobrowse/js/GlanceCobrowseLoader_${version}M.js`;
    if (configurations.selfHosted === "direct-link-to-loader") {
      src = `${configurations.cdn}`;
    }
  } else {
    src = `https://${configurations.cdn}/cobrowse/CobrowseJS.ashx?group=${configurations.groupId}&site=${configurations.environment}`;
  }
  theCobrowseScript.setAttribute("src", src);

  // Add the script tag to the page
  document.head.append(theCobrowseScript);

  // Set some UI elements
  switch (dataWs) {
    case "www.glance.net":
      document.querySelector("header").style.background = "#B3C5CE";
      break;
    case "beta.glance.net":
      document.querySelector("header").style.background = "#BF40BF";
      break;
    case "www.myglance.net":
      document.querySelector("header").style.background = "#e74c3c";
      break;
    case "dw1.myglance.org":
      document.querySelector("header").style.background = "#a4fba6";
      break;
    case "dw2.myglance.org":
      document.querySelector("header").style.background = "#4ae54a";
      break;
    case "dw3.myglance.org":
      document.querySelector("header").style.background = "#30cb00";
      break;
    case "dw4.myglance.org":
      document.querySelector("header").style.background = "#0f9200";
      break;
    default:
      document.querySelector("header").style.background = "#D1343E";
      break;
  }

  document.getElementById("submit-button").setAttribute("disabled", true);

  theCobrowseScript.addEventListener("load", (e) => {
    document.getElementById("cb-version").innerHTML =
      `Cobrowse script version: ${GLANCE.VERSION}` + ` patch ${GLANCE.PATCH}`;
  });
}

export { refreshConfigs, addTheScript };
