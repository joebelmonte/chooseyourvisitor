(function() {'use strict';
class CustomSelect extends HTMLElement {
  connectedCallback() {
    this.innerHTML = '<ul class="glance_select-list glance_select-ul"></ul><div class="glance_select-downarrow"></div><button type="button" role="button" class="glance_select-button glance_guest_controls" aria-haspopup="true" aria-expanded="false" aria-label="Select Camera to use"></button>';
    this.list = this.querySelector(".glance_select-list");
    this.downarrow = this.querySelector(".glance_select-downarrow");
    this.button = this.querySelector("button");
    this.hideDropdown();
    this.button.addEventListener("click", () => {
      this.toggleVisibility();
    });
    this.addEventListener("focus", () => {
      this.button.focus();
    });
    document.addEventListener("click", a => {
      this.visible && !this.contains(a.target) && this.hideDropdown();
    });
    this.list.addEventListener("focusout", a => {
      this.contains(a.relatedTarget) || this.hideDropdown();
    });
  }
  constructor() {
    super();
  }
  size() {
    return this.list.children.length;
  }
  addItem(a, b) {
    let d = document.createElement("li");
    d.innerHTML = a;
    d.setAttribute("value", b);
    d.setAttribute("tabIndex", "-1");
    d.addEventListener("click", () => {
      this.selectItem(d);
      this.hideDropdown();
      this.dispatchEvent(new Event("selchange"));
    });
    d.addEventListener("keydown", c => {
      switch(c.code) {
        case "ArrowDown":
          d.nextElementSibling && d.nextElementSibling.focus();
          break;
        case "ArrowUp":
          d.previousElementSibling && d.previousElementSibling.focus();
          break;
        case "Enter":
          d.dispatchEvent(new Event("click"));
          break;
        case "Escape":
          this.hideDropdown();
          this.button.focus();
          break;
        default:
          return;
      }
      c.preventDefault();
      c.stopPropagation();
    });
    this.list.appendChild(d);
  }
  selectItem(a) {
    this.selectedElem && this.selectedElem.classList.remove("glance_select-selected");
    this.selectedElem = "number" === typeof a ? this.list.children[a] : a;
    this.selectedElem.classList.add("glance_select-selected");
    this.selectedElem.focus();
  }
  selectValue(a) {
    this.list.querySelectorAll("li").forEach(b => {
      b.getAttribute("value") === a && (this.selectedElem && this.selectedElem.classList.remove("glance_select-selected"), this.selectedElem = b, this.selectedElem.classList.add("glance_select-selected"), this.selectedElem.focus());
    });
  }
  hasValue(a) {
    let b = !1;
    this.list.querySelectorAll("li").forEach(d => {
      d.getAttribute("value") === a && (b = !0);
    });
    return b;
  }
  getSelectedValue() {
    return this.selectedElem ? this.selectedElem.getAttribute("value") : "";
  }
  toggleVisibility() {
    this.visible ? this.hideDropdown() : this.showDropdown();
  }
  showDropdown() {
    this.visible = !0;
    for (let a of [this.list, this.downarrow]) {
      a.style.visibility = "visible";
    }
    this.querySelector(".glance_select-selected").focus();
    this.classList.remove("glance_tooltip");
  }
  hideDropdown() {
    this.visible = !1;
    for (let a of [this.list, this.downarrow]) {
      a.style.visibility = "hidden";
    }
    this.hasAttribute("data-title") && this.classList.add("glance_tooltip");
  }
}
customElements.get("glance-custom-select") || window.customElements.define("glance-custom-select", CustomSelect);
/*
 Copyright 2022 Glance Networks, Inc.
*/
var GLANCE_LOGGER = !0, GlanceLogger = {sanitize:function(a) {
  return a.replace(/[\r\n]/g, " ").replace("<", "&lt;");
}, _log:function(a, ...b) {
  !window.console || !window.console[a] || window.GLANCE_COBROWSE && window.GLANCE_COBROWSE.disableLogging || (b = b.map(d => {
    if ("object" === typeof d) {
      try {
        d = JSON.stringify(d);
      } catch (c) {
        console.error(c), d = "unable to convert object to string";
      }
    }
    return "string" === typeof d ? GlanceLogger.sanitize(d) : d;
  }), window.console[a](...b));
}, log:function(...a) {
  GlanceLogger._log("log", ...a);
}, error:function(...a) {
  GlanceLogger._log("error", ...a);
}}, LOG_DIFFS = !1, LOG_DIFFDET = !1, LOG_DRAW = !1, LOG_PRES = !0, LOG_CBSTATE = !1, LOG_IFRAME = !1, LOG_SCROLL = !1, LOG_EVENTS = !1, LOG_LOADER = !1, LOG_UI = !1, LOG_FOCUS = !1, LOG_XDOM = !0, LOG_C3P = !1, LOG_PDF = !1, LOG_STYLES = !1, LOG_GEST = !1, LOG_MSG = !1, LOG_RES = !0, LOG_RC = !1, LOG_SD = !1, LOG_VID = !0, LOG_MASK = !1, LOG_DOC = !1, LOG_XLS = !1, LOG_SS = !1, debuglog = GLANCE_LOGGER ? function(...a) {
  GlanceLogger.log("DEBUG:", ...a);
} : function() {
}, diffslog = GLANCE_LOGGER && LOG_DIFFS ? function(...a) {
  GlanceLogger.log("DIFFS:", ...a);
} : function() {
}, diffdetlog = GLANCE_LOGGER && LOG_DIFFDET ? function(...a) {
  GlanceLogger.log("DIFFDET:", ...a);
} : function() {
}, drawlog = GLANCE_LOGGER && LOG_DRAW ? function(...a) {
  GlanceLogger.log("DRAW:", ...a);
} : function() {
}, preslog = LOG_PRES ? function(...a) {
  GlanceLogger.log("PRES:", ...a);
} : function() {
}, cbstatelog = GLANCE_LOGGER && LOG_CBSTATE ? function(...a) {
  GlanceLogger.log("CBSTATE:", ...a);
} : function() {
}, iframelog = GLANCE_LOGGER && LOG_IFRAME ? function(...a) {
  GlanceLogger.log("IFRAME:", ...a);
} : function() {
}, scrolllog = GLANCE_LOGGER && LOG_SCROLL ? function(...a) {
  GlanceLogger.log("SCROLL:", ...a);
} : function() {
}, eventslog = GLANCE_LOGGER && LOG_EVENTS ? function(...a) {
  GlanceLogger.log("EVENTS:", ...a);
} : function() {
}, loaderlog = GLANCE_LOGGER && LOG_LOADER ? function(...a) {
  GlanceLogger.log("LOADER:", ...a);
} : function() {
}, uilog = GLANCE_LOGGER && LOG_UI ? function(...a) {
  GlanceLogger.log("UI:", ...a);
} : function() {
}, focuslog = GLANCE_LOGGER && LOG_FOCUS ? function(...a) {
  GlanceLogger.log("FOCUS:", ...a);
} : function() {
}, xdomlog = LOG_XDOM ? function(...a) {
  GlanceLogger.log("XDOM:", ...a);
} : function() {
}, c3plog = GLANCE_LOGGER && LOG_C3P ? function(...a) {
  GlanceLogger.log("C3P:", ...a);
} : function() {
}, pdflog = GLANCE_LOGGER && LOG_PDF ? function(...a) {
  GlanceLogger.log("PDF:", ...a);
} : function() {
}, stylelog = GLANCE_LOGGER && LOG_STYLES ? function(...a) {
  GlanceLogger.log("STYLES:", ...a);
} : function() {
}, gestlog = GLANCE_LOGGER && LOG_GEST ? function(...a) {
  GlanceLogger.log("GEST:", ...a);
} : function() {
}, msglog = GLANCE_LOGGER && LOG_MSG ? function(...a) {
  GlanceLogger.log("MSG:", ...a);
} : function() {
}, reslog = GLANCE_LOGGER && LOG_RES ? function(...a) {
  GlanceLogger.log("RES:", ...a);
} : function() {
}, rclog = GLANCE_LOGGER && LOG_RC ? function(...a) {
  GlanceLogger.log("RC:", ...a);
} : function() {
}, sdlog = GLANCE_LOGGER && LOG_SD ? function(...a) {
  GlanceLogger.log("SD:", ...a);
} : function() {
}, vidlog = LOG_VID ? function(...a) {
  GlanceLogger.log("VID:", ...a);
} : function() {
}, masklog = GLANCE_LOGGER && LOG_MASK ? function(...a) {
  GlanceLogger.log("MASK:", ...a);
} : function() {
}, doclog = GLANCE_LOGGER && LOG_DOC ? function(...a) {
  GlanceLogger.log("DOC:", ...a);
} : function() {
}, sslog = GLANCE_LOGGER && LOG_SS ? function(...a) {
  GlanceLogger.log("SS:", ...a);
} : function() {
}, assert = GLANCE_LOGGER ? function(a) {
  if (!a) {
    if (window.console && window.console.error) {
      GlanceLogger.error("ASSERT");
    } else {
      throw Error("ASSERT");
    }
  }
} : function() {
};
function consolelog(...a) {
  GlanceLogger.log("GLANCE:", ...a);
}
function errorlog(...a) {
  GlanceLogger.error("GLANCE:", ...a);
}
;var SSN_COOKIE_NAME = "glance_ssn_info", GLANCEVERSION3 = ["6", "1", "1", "5"].slice(0, 3).join("."), GLANCESCRIPTVERSION = GLANCEVERSION3 + "" + (GLANCE.MINIMIZED ? "M" : "");
function CBScriptTag() {
  this.scripttag = document.getElementById("cobrowsescript") || document.getElementById("glance-cobrowse");
  this.metatag = document.getElementById("glance-cobrowse");
  if (null !== this.scripttag) {
    var a = _GLANCE.Config.getCobrowseConfigData();
    _GLANCE.Config.Params.copy(a, this);
    var b = /\/\/(.*)\//.exec("string" === typeof this.scripttag.src ? this.scripttag.src : a.scriptserver + "/");
    this.scriptServer = b && 2 === b.length ? b[1] : "www.glancecdn.net/cobrowse";
    this.scriptServer = this.scriptServer.replace("/js", "");
    a.cbexperiment && (this.scriptServer = this.scriptServer.replace("cobrowse", "cbexperiment"));
    b = (a.oninit || "").split(":");
    this.groupid = a.groupid || this.scripttag.getAttribute("groupid");
    this.webServerHost = a.ws || this.scripttag.getAttribute("ws") || "www.glance.net";
    this.webServer = this.webServerHost + "/cobrowse";
    this.dev = !this.webServerHost.match("\\.glance\\.net$");
    this.cookiedomain = a.cookiedomain;
    this.ui = a.ui;
    this.cookietype = a.cookietype;
    this.hostkey = a.hostkey;
    this.uri = a.uri;
    this.oninit = {command:b[0], param:b[1]};
    this.site = a.site || this.scripttag.getAttribute("site") || "production";
    this.inputEvents = JSON.parse(a.inputevents || "{}");
    this.presence = a.presence;
    if (!this.groupid) {
      throw Error("data-groupid missing");
    }
    a = a.additionalgroupids || "";
    this.groupids = [this.groupid].concat(a ? a.split(",") : []);
    this.groupids = this.groupids.map(function(d) {
      if (!parseInt(d)) {
        throw Error("data-groupid invalid: " + d);
      }
      return parseInt(d);
    });
    if (!/staging|production/i.test(this.site)) {
      throw Error("data-site invalid");
    }
  }
}
CBScriptTag.prototype.nativeInstance = function(a, ...b) {
  if (!this.cleanContextWindow) {
    let d = document.createElement("iframe");
    d.style.display = "none";
    d.setAttribute("data-no-cobrowse-content", 1);
    document.body.appendChild(d);
    this.cleanContextWindow = d.contentWindow;
  }
  a = this.cleanContextWindow[a];
  return new (Function.bind.apply(a, [a, ...b]));
};
CBScriptTag.prototype.ready = function() {
  return null !== this.scripttag;
};
CBScriptTag.prototype.makeUrl = function(a) {
  return URL.toString().includes("[native code]") ? (new URL(`https://${this.scriptServer}/${a}`)).href : this.nativeInstance("URL", `https://${this.scriptServer}/${a}`).href;
};
CBScriptTag.prototype.makeWebServiceUrl = function(a) {
  return URL.toString().includes("[native code]") ? (new URL(`https://${this.webServerHost}/${a}`)).href : this.nativeInstance("URL", `https://${this.webServerHost}/${a}`).href;
};
CBScriptTag.prototype.includesGroupId = function(a) {
  a = parseInt(a);
  return this.groupid === a || 0 <= this.groupids.indexOf(a);
};
CBScriptTag.prototype.setCustomizationVersion = function(a) {
  this.custver || (this.custver = a);
};
CBScriptTag.prototype.coalesceSessionStartParams = function(a, b) {
  function d(e, f, k) {
    k.forEach(g => {
      e[g] = f[g] || e[g];
    });
  }
  var c = {};
  d(c, a, ["video", "content"]);
  d(c, this, ["name", "email", "phone", "video", "content"]);
  c.sessionKey = c.sessionKey || this.visitorid || "GLANCE_KEYTYPE_RANDOM";
  "off" !== c.video && !1 === a.nwayvideoallowed && (console.error("ERR_NO_NWAYVIDEO_SETTINGS"), c.video = "off");
  Object.assign(c, b || {});
  return c;
};
CBScriptTag.prototype.addGlanceVideo = async function() {
  let a = b => new Promise(d => {
    if (document.querySelector(`script[src*=${b}]`)) {
      d();
    } else {
      let c = document.createElement("script");
      c.addEventListener("load", d);
      c.setAttribute("type", "text/javascript");
      c.setAttribute("src", `//${this.scriptServer}/js/${b}_${GLANCESCRIPTVERSION}M.js`);
      document.head.appendChild(c);
    }
  });
  await a("browserCap");
  return a("GlanceVideoSource");
};
CBScriptTag.prototype.addStylesheets = function(a) {
  function b(e, f, k) {
    if (!document.getElementById(e)) {
      uilog("adding stylesheet", e);
      var g = document.createElement("link"), h = document.getElementsByTagName("head")[0];
      g.id = e;
      g.type = "text/css";
      g.rel = "stylesheet";
      g.media = "all";
      g.href = f;
      k = k || h.firstElementChild;
      h.insertBefore(g, k);
    }
  }
  function d(e) {
    return new Promise((f, k) => {
      let g = document.getElementById(e);
      "1" === g.getAttribute("data-loaded") ? (uilog(`stylesheet ${e} already loaded`), f()) : (g.addEventListener("load", () => {
        g.setAttribute("data-loaded", "1");
        uilog(`stylesheet ${e} loaded`);
        f();
      }, {once:!0}), g.addEventListener("error", f, {once:!0}));
    });
  }
  this.currentGroupId || b("glance_ss", this.makeUrl("styles/Cobrowse_" + GLANCEVERSION3 + ".css"));
  if (this.currentGroupId !== a) {
    this.currentGroupId = a;
    var c = document.getElementById("glance_customss");
    c && c.parentElement.removeChild(c);
    b("glance_customss", this.makeUrl("customstyles/CustomSkin_" + a + "_" + this.site.substr(0, 1).toUpperCase() + ".css?gv=4&v=" + this.custver), document.getElementById("glance_ss").nextElementSibling);
  }
  return Promise.all([d("glance_ss"), d("glance_customss")]).then(() => {
    uilog("all stylesheets loaded");
  });
};
function CookieUtils() {
}
CookieUtils.makeCookie = function(a) {
  var b = SSN_COOKIE_NAME;
  switch(a.cookietype) {
    case "ls":
      var d = GLANCE.Lib.lsCookie;
      break;
    case "dual":
      d = GLANCE.Lib.DualCookie;
      break;
    default:
      d = GLANCE.Lib.Cookie;
  }
  return new d(b, a.cookiedomain);
};
CookieUtils.dropCookie = function(a, b) {
  CookieUtils.makeCookie(a).setObj(b, "secure" === a.cookietype);
};
var fixButtons = function(a) {
  if (0 >= Math.floor(a.scrollLeft)) {
    var b = "left";
    document.getElementById("glance_scroll-left").disabled = !0;
    document.getElementById("glance_scroll-right").disabled = !1;
  } else {
    7 > a.scrollWidth - a.scrollLeft - a.offsetWidth ? (b = "right", document.getElementById("glance_scroll-right").disabled = !0) : (b = "both", document.getElementById("glance_scroll-right").disabled = !1), document.getElementById("glance_scroll-left").disabled = !1;
  }
  a.setAttribute("data-smallvideoscroll", b);
};
class CobrowseVideoUtils {
  static getViewerId(a, b) {
    return "original" !== (b || "original") ? `glance_video_${a}` : "glance_agentvideo";
  }
  static validFile(a) {
    return ["application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"].includes(a.type) || a.name.match(".csv");
  }
  static validSize(a) {
    return 5 > a.size / 1048576;
  }
  static scrollVideoStrip(a) {
    var b = document.querySelector("#glance_video_containers");
    if (b) {
      return b.scrollLeft = a ? b.scrollLeft + 191 : b.scrollLeft - 191, fixButtons(b), b.scrollLeft;
    }
  }
  static setVideoScrollOffset(a) {
    var b = document.querySelector("#glance_video_containers");
    if (b) {
      return b.scrollLeft = a, fixButtons(b), b.scrollLeft;
    }
  }
}
;var _GLANCE = _GLANCE || {};
_GLANCE.Config = {};
_GLANCE.Config.Params = {};
_GLANCE.Config.Params.copy = function(a, b, d) {
  if (void 0 !== a) {
    return d = d || Object.keys(a), d.forEach(function(c) {
      void 0 !== a[c] && (b[c] = a[c]);
    }), b;
  }
};
_GLANCE.Config.Params.getDataAttrs = function(a) {
  var b = {};
  if (!a) {
    return b;
  }
  var d = 0;
  for (a = a.attributes; d < a.length; d++) {
    var c = a[d].nodeName.match(/data-(.*)/);
    c && 2 === c.length && (b[c[1]] = a[d].nodeValue);
  }
  return b;
};
_GLANCE.Config.getCobrowseConfigData = function() {
  var a = window.GLANCE_COBROWSE ? window.GLANCE_COBROWSE : {}, b = document.getElementById("cobrowsescript"), d = document.getElementById("glance-cobrowse");
  b = _GLANCE.Config.Params.getDataAttrs(b);
  d = _GLANCE.Config.Params.getDataAttrs(d);
  _GLANCE.Config.Params.copy(b, a);
  _GLANCE.Config.Params.copy(d, a);
  return a;
};
var ie = document.documentMode && window.XDomainRequest, iever = ie ? document.documentMode : 0, ios = !!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform), screenshare, visitorvideo, visitorsettings = {}, ssnbutton, messageboxes, visitorText, termsdialog, cbscripttag = new CBScriptTag;
function getVisitorLanguage(a, b, d) {
  let c = document.documentElement.getAttribute("lang"), e = c ? [c, ...b] : b;
  for (var f = 0; f < e.length; f++) {
    if (a.includes(e[f])) {
      return e[f];
    }
  }
  for (f = 0; f < e.length; f++) {
    if (b = a.filter(k => k.substr(0, 2).toLowerCase() === e[f].substr(0, 2).toLowerCase()), 0 < b.length) {
      return b[0];
    }
  }
  return d;
}
let nativeFetch;
if (fetch.toString().includes("native code")) {
  nativeFetch = window.fetch;
} else {
  var frame = document.createElement("iframe");
  frame.style.display = "none";
  frame.setAttribute("data-no-cobrowse-content", 1);
  document.body.appendChild(frame);
  nativeFetch = frame.contentWindow.fetch;
}
function getVisitorUISettings() {
  uilog("getVisitorUISettings");
  return nativeFetch(cbscripttag.makeWebServiceUrl(`api/CobrowseSettings/VisitorUISettings?groupid=${cbscripttag.groupid}&site=${cbscripttag.site}&ver=${GLANCE.VERSION}`)).then(a => {
    if (!a.ok) {
      throw Error(`ERR_SETTINGS: ${a.status} ${a.statusText}`);
    }
    uilog("got Visitor UI Settings");
    return a.json();
  });
}
function getButtonHTML(a) {
  uilog("getButtonHTML");
  return nativeFetch(cbscripttag.makeUrl(`html/visitor-${a.widgetstyle}-${GLANCEVERSION3}.html`)).then(b => {
    if (!b.ok) {
      throw Error(`ERR_HTML: ${b.status} ${b.statusText}`);
    }
    uilog("got Button HTML");
    return b.text();
  });
}
async function getButtonText(a) {
  uilog("getButtonText accept languages:", a.acceptlanguages);
  var b = getVisitorLanguage(a.languages, a.acceptlanguages, a.defaultlanguage);
  let d = cbscripttag.makeUrl(`text/${a.settingsparentgroupid}/VisitorText_${a.settingsparentgroupid}_${b}_${cbscripttag.site.toUpperCase().charAt(0)}.json?v=${a.custver}`);
  a = a.customizedlanguages.includes(b) ? nativeFetch(d).then(c => c.ok ? c.json() : {}) : Promise.resolve({});
  b = cbscripttag.makeUrl(`text/VisitorText_${b}_${GLANCEVERSION3}.json`);
  b = nativeFetch(b).then(c => c.ok ? c.json() : {});
  b = await Promise.all([a, b]);
  return Object.assign({}, b[1], b[0]);
}
function replaceButtonText(a, b) {
  for (const d in b) {
    a = a.split(`\$\{${d}\}`).join(b[d]);
  }
  return a;
}
function presenceFire(a, b) {
  GLANCE.Presence && GLANCE.Presence.Visitor && GLANCE.Presence.Visitor.instance && GLANCE.Presence.Visitor.instance.fire(a, b);
}
function getElement(a) {
  function b(c) {
    this.elem = c;
    this.show = function(e) {
      void 0 === e && (e = !0);
      var f = e ? "glance_show" : "glance_hide";
      e = new RegExp(e ? "glance_hide" : "glance_show", "g");
      c.className.match(new RegExp(f, "g")) || (c.className.match(e) ? c.className = c.className.replace(e, f) : this.addClass(f));
    };
    this.hide = function() {
      this.show(!1);
    };
    this.getElement = function(e) {
      return (e = c.querySelectorAll(e)[0]) ? new b(e) : null;
    };
    this.setClass = function(e) {
      c.className = e;
    };
    this.addClass = function(e) {
      e.split(" ").forEach(f => {
        c.classList.add(f);
      });
    };
    this.removeClass = function(e) {
      e && e.split(" ").forEach(f => {
        c.classList.remove(f);
      });
    };
    this.toggleClass = function(e) {
      c.classList.toggle(e);
    };
    this.addEvent = function(e, f, k, g) {
      c.addEventListener(e, function(h) {
        f(h);
        !1 !== k && (h.preventDefault(), h.stopPropagation());
      }, g);
    };
    this.getAttr = function(e) {
      return c.getAttribute(e);
    };
    this.setAttr = function(e, f) {
      c.setAttribute(e, f);
    };
    this.removeAttrs = function(e) {
      let f = c.attributes, k = [];
      for (var g = 0; g < f.length; g++) {
        f[g].name.startsWith(e) && k.push(f[g].name);
      }
      for (g = 0; g < k.length; g++) {
        c.removeAttribute(k[g]);
      }
    };
    this.text = function(e) {
      "string" === typeof e && (c.innerText = e);
      return c.innerText;
    };
    this.makeDialog = function(e, f, k, g, h = !0) {
      function l() {
        f();
        h && m.previousFocus && m.previousFocus.focus();
      }
      var m = this;
      this.trapFocus(!0);
      k && g && getElement(k).addEvent("click", g, !1);
      this.setAttr("role", "alertdialog");
      this.setAttr("aria-modal", "true");
      this.focuselem = window.safari || ios ? c.querySelectorAll("button")[0] : c;
      c.tabIndex = -1;
      this.handleKey(27, "", l);
      getElement(e).addEvent("click", l, !0);
    };
    this.showDialog = function(e, f) {
      "undefined" === typeof e && (e = !0);
      this.previousFocus = document.activeElement;
      e && this.show();
      this.focuselem.focus();
      f || this.trapFocusInDialog();
    };
    this.focus = function() {
      c.focus();
    };
    this.trapFocus = function(e) {
      this.handleKey(9, e ? "shift" : "", function() {
      });
    };
    this.trapFocusInDialog = function() {
      var e = Array.from(c.querySelectorAll("a, input, button, select")).filter(f => null !== f.offsetParent);
      1 <= e.length && ((new b(e[0])).trapFocus(!0), (new b(e[e.length - 1])).trapFocus(!1));
    };
    this.handleKey = function(e, f, k) {
      this.addEvent("keydown", function(g) {
        if (9 !== e || g.target === g.currentTarget) {
          var h = g.shiftKey || g.ctrlKey || g.altKey;
          g.keyCode === e && (f && g[f + "Key"] || !f && !h) && (k(), g.preventDefault(), g.stopPropagation());
        }
      }, !1);
    };
  }
  var d;
  return (a = "string" === typeof a ? a.match(/^#/) ? document.getElementById(a.substr(1)) : (d = document.querySelectorAll(a)) ? d[0] : null : a) ? new b(a) : null;
}
function getDocument() {
  return new function() {
    var a = document;
    this.onLoad = function(b) {
      a.readyState.match(/uninitialized|loading/) ? a.addEventListener("DOMContentLoaded", b) : b();
    };
  };
}
let GlanceVideo = {get:function() {
  let a = {bgFilterEnabled:visitorsettings.videobgblurallowed, bgType:"blur"};
  Object.assign(a, JSON.parse(visitorsettings.videomaxquality));
  a.framerate = 24;
  delete a.modelID;
  return new GLANCE.Video.GlanceVideoSource(a);
}};
var UIState = {EXPANDED:"expanded", BOXSTATE:"boxstate", RCENABLED:"rcenabled", WIDGETPOS:"widgetpos", AGENTJOINED:"agentjoined", DOCSHARETERMSACCEPTED:"docsharetermsaccepted", set:function(a, b) {
  GLANCE.Cobrowse.Visitor.inSession() && GLANCE.Cobrowse.Visitor.setCookieValue(a, b);
}, get:function(a) {
  return GLANCE.Cobrowse.Visitor.inSession() ? GLANCE.Cobrowse.Visitor.getCookieValue(a) : null;
}};
function Confirmation() {
  this.confirm = getElement("#glance_confirm");
  this.scrim = getElement("#glance_scrim");
  var a = this;
  getElement("#glance_confirm_primary_button").addEvent("click", function() {
    a.hide();
    a.onPrimaryButtonClick();
  });
  this.confirm.makeDialog("#glance_confirm_secondary_button", function() {
    a.hide();
    a.onSecondaryButtonClick();
  });
}
Confirmation.prototype.hide = function() {
  this.confirm.hide();
  this.scrim.hide();
  this.scrim.removeClass("glance-confirm");
  this.confirm.previousFocus && this.confirm.previousFocus.focus();
};
Confirmation.prototype.show = function(a, b, d, c, e = "", f = visitorText["button-yes"], k = visitorText["button-no"]) {
  this.onPrimaryButtonClick = d;
  this.onSecondaryButtonClick = c ? c : function() {
  };
  d = getElement("#glance_confirm_msg");
  c = getElement("#glance_confirm_msg_header");
  d.setClass(a);
  "original" !== this.widgetstyle && (d.text(b), c.text(e));
  getElement("#glance_confirm_primary_button").text(f);
  getElement("#glance_confirm_secondary_button").text(k);
  this.confirm.showDialog();
  this.scrim.show();
  this.scrim.addClass("glance-confirm");
};
class VideoPreview extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback() {
    if (!this.querySelector(".glance_vvc_preview")) {
      this.appendChild(getElement("#glance_videopreviewwidget").elem.content.cloneNode(!0));
      var a = getElement(this);
      this.videosources = a.getElement(".glance_selectvideosource");
      this.preview = a.getElement("video");
      this.previewcontainer = a.getElement(".glance_vvc_preview");
      this.cameramessage = a.getElement(".glance_vvc_cameramessage");
      this.overlaymessage = a.getElement(".glance_vvc_overlaymessage");
      this.onoffbutton = a.getElement(".glance_camera-on-off");
      this.blurbutton = a.getElement(".glance_camera-blur");
      this.vidgradation = a.getElement(".glance_vid-gradation");
      this.previewsetup = !1;
      navigator.vendor.startsWith("Apple") && this.safariVideoWorkaround();
      this.videosources.addEvent("selchange", b => {
        localStorage.setItem("GlanceSelectedCamera", this.videosources.elem.getSelectedValue());
        this.dispatchEvent(new Event("settingschange"));
        this.showCameraMessage("");
        this.stop();
        this.start();
      });
      this.onoffbutton.addEvent("click", b => {
        this.cameraon = !this.cameraon;
        this.dispatchEvent(new Event("settingschange"));
        this.previewcontainer.toggleClass("glance_pausedvideo");
        this.cameraon ? this.start() : (this.stop(), this.showCameraMessage(""));
      });
      this.blurbutton.addEvent("click", () => {
        this.videobgblur = !this.videobgblur;
        this.setBgBlur(this.videobgblur);
      });
    }
  }
  safariVideoWorkaround() {
    let a = document.createElement("video");
    for (var b = this.preview.elem.attributes, d = 0; d < b.length; d++) {
      a.setAttribute(b[d].nodeName, b[d].nodeValue);
    }
    b = this.preview.elem.previousSibling;
    d = this.preview.elem.parentElement;
    this.preview.elem.remove();
    d.insertBefore(a, b);
    this.preview = getElement(a);
  }
  getCameraSettings() {
    return {videosource:this.videosources.elem.getSelectedValue().split("|")[0], camerastatus:this.camerastatus, videopaused:!this.cameraon, videobgfilter:!!this.videobgblur, videobgtype:this.videobgtype};
  }
  async start() {
    await this.populateCameraSelect();
    let a = localStorage.getItem("GlanceSelectedCamera"), b = null;
    a ? (b = {label:a.split("|")[0], deviceId:a.split("|")[1]}, this.videosources.elem.selectValue(a)) : this.videosources.elem.size() && (b = {label:this.videosources.elem.getSelectedValue().split("|")[0], deviceId:this.videosources.elem.getSelectedValue().split("|")[1]});
    vidlog("Starting preview for source:", b);
    await this.glanceVideo.initialize(b, this.preview.elem, !1);
    if (!this.glanceVideo) {
      return !1;
    }
    this.videosources.elem.size() || this.handleCameraError({name:"NotAllowedError"});
    return !!this.glanceVideo;
  }
  stop(a) {
    this.glanceVideo && (this.glanceVideo.stopPreview(this.preview.elem, a && this.cameraon), this.displaypreview(!1), this.onoffbutton.setAttr("aria-pressed", !1), this.previewrunning = !1, this.showCameraMessage(""), this.overlaymessage.hide());
  }
  setBgBlur(a) {
    this.blurbutton.setAttr("aria-pressed", a);
    this.dispatchEvent(new Event("settingschange"));
    this.glanceVideo.setBgFilterActive(a);
    VideoPreview.videoBlurFailed && (a ? this.showVideoOverlayMessage(visitorText["camera-message-blurperformance"]) : this.overlaymessage.hide());
  }
  hidePreviewControls() {
    this.onoffbutton.hide();
    this.blurbutton.hide();
    this.videosources.hide();
    this.overlaymessage.hide();
  }
  displaypreview(a) {
    this.preview.show(a);
    this.vidgradation.show(a);
  }
  shutdownPreview(a) {
    if (this.previewsetup) {
      return this.stop(a), this.previewsetup = !1, this.hidePreviewControls(), this.glanceVideo;
    }
  }
  async getDefaultCamera() {
    try {
      let d = (await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"}})).getVideoTracks()[0];
      var a = d.getCapabilities().deviceId;
      var b = d.label;
      d.stop();
    } catch (d) {
      return {exception:d};
    }
    return {deviceId:a, deviceLabel:b};
  }
  isMobileDevice() {
    try {
      let a = navigator.userAgent.toLowerCase(), b = navigator.platform.toLowerCase();
      return null !== (a.match(/ip(?:ad|od|hone)/) || b.match(/mac/) && "undefined" !== typeof navigator.standalone ? "ios" : (a.match(/(?:webos|android)/) || b.match(/mac|win|linux/) || ["other"])[0]).match(/^(ios|android)$/);
    } catch (a) {
      return console.error("Exception in isMobileDevice", a), !1;
    }
  }
  setupPreview() {
    if (this.previewsetup) {
      return Promise.resolve();
    }
    this.previewsetup = !0;
    this.previewrunning = !1;
    this.glanceVideo = GlanceVideo.get();
    this.glanceVideo.addEventListener("bgFilterPerformanceFail", () => {
      this.showVideoOverlayMessage(visitorText["camera-message-blurperformance"]);
      VideoPreview.videoBlurFailed = !0;
    });
    this.glanceVideo.addEventListener("previewStarted", a => {
      vidlog("previewStarted");
      this.glanceVideo && (this.videobgtype = this.glanceVideo.getBackgroundSettings().capable && visitorsettings.videobgblurallowed ? "blur" : "none", this.videobgblur = this.glanceVideo.getBackgroundSettings().capable && visitorsettings.videobgblurallowed, this.displaypreview(!0), this.setBgBlur(this.videobgblur), this.camerastatus = "available", this.cameramessage.text(""), this.previewrunning = !0, this.dispatchEvent(new Event("settingschange")), this.onoffbutton.setAttr("aria-pressed", !0), 
      this.displaypreview(!0));
    });
    this.hidePreviewControls();
    this.cameraon = !0;
    this.camerastatus = "nocamera";
    this.previewcontainer.removeClass("glance_pausedvideo");
    this.onoffbutton.setAttr("aria-pressed", this.cameraon);
    this.displaypreview(!1);
    return new Promise(async(a, b) => {
      if ("https:" !== window.location.protocol) {
        console.error("ERR_VIDEO_INSECURE"), b();
      } else {
        this.glanceVideo.addEventListener("error", d => {
          vidlog("Glance video error event:", d);
          this.handleCameraError(d.name ? d : {name:d});
          b();
        });
        this.preview.addEvent("play", () => {
          this.previewsetup && (window.setTimeout(() => {
            "nocamera" !== this.camerastatus && this.showCameraMessage(visitorText["camera-message-previewing"], !0);
          }, 2000), "nocamera" !== this.camerastatus && (this.camerastatus = "available", this.onoffbutton.show("visible" === this.getAttribute("data-onoffbutton")), this.glanceVideo.getBackgroundSettings().capable && visitorsettings.videobgblurallowed && visitorsettings.videobgblurtoggle && this.blurbutton.show("visible" === this.getAttribute("data-blurbutton")), this.showVideoSources(), a()));
        }, !0, {once:!0});
        try {
          await this.start() ? visitorsettings.videobgblurallowed && !this.glanceVideo.getBackgroundSettings().capable && "abortvideo" === visitorsettings.bgdetectfailmode && (this.cameraon = !1, this.camerastatus = "nocamera", this.showCameraMessage(visitorText["camera-message-noblurnovideo"], !1), a()) : a();
        } catch (d) {
          vidlog("Exception", d, "setting up camera preview"), this.handleCameraError(d.name ? d : {name:d}), b();
        }
      }
    });
  }
  showVideoSources() {
    1 < this.videosources.elem.size() && !this.isMobileDevice() && this.videosources.show();
  }
  handleCameraError(a) {
    let b = visitorText[`camera-error-${a.name.toLowerCase()}`] || a.name;
    this.showCameraMessage(b);
    switch(a.name) {
      case "NotFoundError":
        this.camerastatus = "nocamera";
        break;
      case "NotAllowedError":
        this.camerastatus = "blocked";
        break;
      case "NotSupported":
        this.camerastatus = "notsupported";
        break;
      case "NotReadableError":
        this.camerastatus = "error", this.showVideoSources();
      default:
        this.camerastatus = "error";
    }
    this.dispatchEvent(new Event("settingschange"));
  }
  async populateCameraSelect() {
    if (!(0 < this.videosources.elem.size())) {
      return new Promise(a => {
        this.glanceVideo.getSources(b => {
          this.isMobileDevice() && (b = b.filter(d => d.name.startsWith("front")));
          for (let d of b) {
            this.videosources.elem.addItem(d.name, `${d.label}|${d.deviceId}`);
          }
          b.length && ((b = localStorage.getItem("GlanceSelectedCamera")) && this.videosources.elem.hasValue(b) ? this.videosources.elem.selectValue(b) : (this.videosources.elem.selectItem(0), localStorage.setItem("GlanceSelectedCamera", this.videosources.elem.getSelectedValue())));
          a();
        });
      });
    }
  }
  showCameraMessage(a, b) {
    b || this.displaypreview(!1);
    this.cameramessage.setAttr("data-showforrole", b ? "agent" : "all");
    this.cameramessage.text(a);
  }
  showVideoOverlayMessage(a) {
    this.overlaymessage.show();
    this.overlaymessage.text(a);
  }
}
customElements.get("glance-video-preview") || window.customElements.define("glance-video-preview", VideoPreview);
function VisitorVideoConfirmation() {
  if (this.confirm = getElement("#glance_visitorvideoconfirm")) {
    this.scrim = getElement("#glance_scrim"), this.videopreview = this.confirm.getElement("glance-video-preview").elem, this.confirm.getElement("#glance_vvc_accept").addEvent("click", () => {
      this.onAccept(this.videopreview.getCameraSettings(), this.videopreview.shutdownPreview(!0));
      this.hide();
    }), this.confirm.makeDialog("#glance_vvc_decline", () => {
      this.onDecline(this.videopreview.getCameraSettings());
      this.hide();
    }), this.shown = !1;
  }
}
VisitorVideoConfirmation.prototype.hide = function() {
  this.confirm && this.shown && (this.videopreview.shutdownPreview(), Confirmation.prototype.hide.call(this), this.shown = !1);
};
VisitorVideoConfirmation.prototype.show = function(a, b) {
  this.shown || (this.shown = !0, this.onAccept = a, this.onDecline = b, this.confirm ? (this.confirm.showDialog(), this.scrim.show(), this.confirm.getElement("#glance_vvc_accept").elem.disabled = !0, this.videopreview.setupPreview().then(() => {
    this.confirm.getElement("#glance_vvc_accept").elem.disabled = !1;
  }).catch(() => {
  })) : console.error("ERR_NO_NWAYVIDEO"));
};
function Screenshare() {
  this.name = "glance_screenshare";
  this.view = getElement("#glance_ssview");
  this.scrim = getElement("#glance_scrim");
}
Screenshare.prototype.show = function(a) {
  (a = "ended" !== a.state && "still-ended" !== a.state && !a.paused) ? (this.view.show(a), ssnbutton.button.addClass("viewingscreenshare"), ssnbutton.showAnnouncementPill(!0, visitorText["agent-sharing-pill"])) : this.hide();
  "original" === visitorsettings.widgetstyle && this.scrim.show(a);
};
Screenshare.prototype.hide = function() {
  this.view.show(!1);
  ssnbutton.button.removeClass("viewingscreenshare");
  "original" === visitorsettings.widgetstyle && this.scrim.show(!1);
};
Screenshare.prototype.viewerinfo = function() {
};
Screenshare.prototype.pause = function() {
  this.show({state:"continued", paused:!0});
  ssnbutton.button.removeClass("viewingscreenshare");
};
Screenshare.prototype.resume = function() {
  this.show({state:"continued", paused:!1});
  ssnbutton.button.addClass("viewingscreenshare");
};
class AgentVideo {
  constructor(a, b, d) {
    this.role = b || "visitor";
    this.number = a;
    this.name = CobrowseVideoUtils.getViewerId(a, visitorsettings.widgetstyle);
    this.displayName = d || "";
    this.addToDOM();
    this.iframe = getElement("#" + this.name);
  }
  addToDOM() {
    if (!getElement("#" + this.name)) {
      var a = getElement("#glance_video_containers");
      if (a) {
        var b = getElement("#glance_videoviewertemplate").elem.content.cloneNode(!0);
        b.getElementById("glance_video_container_n").id = `glance_video_container_${this.number}`;
        b.getElementById("glance_video_n").id = `glance_video_${this.number}`;
        this.container = b.children[0];
        this.container.setAttribute("data-role", this.role);
        this.container.querySelector(".glance_pausevideobutton").setAttribute("data-participantnum", this.number);
        this.container.querySelector(".glance_ejectguestbutton").setAttribute("data-participantnum", this.number);
        this.container.querySelector(".glance-participant-name").innerText = this.displayName;
        a.elem.appendChild(this.container);
        "left" !== a.getAttr("data-smallvideoscroll") && a.setAttr("data-smallvideoscroll", "both");
      }
    }
  }
  removeFromDOM() {
    this.container && this.container.remove();
  }
  show(a) {
    this.params = a.params;
    if (!a.paused) {
      switch(a.state) {
        case "error":
        case "still-error":
          this.videoError();
          break;
        case "ended":
          this.videoOff();
          break;
        case "still-ended":
          this.setVideoState(VideoState.PAUSED);
          break;
        default:
          this.videoOn("new" === a.state);
      }
    }
  }
  setVideoState(a) {
    this.videostate = a;
    ssnbutton.setVideoParticipantState(this.number, a);
  }
  videoOn(a) {
    this.setVideoState(VideoState.ON);
    ssnbutton.nwayVideoMode() || (ssnbutton.setBoxState(SessionButton.BOXSTATE_VIDEO), ssnbutton.announceAccessibilityStatus(visitorText["video-started-text"]), a && ssnbutton.setExpanded(!0));
    ssnbutton.restoreWidgetPos();
  }
  videoOff() {
    this.setVideoState(VideoState.PAUSED);
    ssnbutton.announceAccessibilityStatus(visitorText["video-ended-text"]);
    ssnbutton.nwayVideoMode() || 0 !== AgentVideo.numViewersOn() || (ssnbutton.setBoxState(SessionButton.BOXSTATE_JOINED), ssnbutton.setExpanded(!1));
    ssnbutton.restoreWidgetPos();
  }
  videoError() {
    this.setVideoState(VideoState.ERROR);
  }
  viewerinfo(a) {
    uilog("Viewer info:" + JSON.stringify(a));
  }
  pause() {
    this.videoOff();
  }
  resume() {
    this.videoOn(!0);
  }
  static syncViewerList(a) {
    let b = [];
    a.forEach(d => {
      d = CobrowseVideoUtils.getViewerId(d.num, visitorsettings.widgetstyle);
      b.push(d);
    });
    for (const d in this.videoViewers) {
      b.includes(d) || (this.videoViewers[d].removeFromDOM(), delete this.videoViewers[d]);
    }
    a.forEach(d => {
      let c = CobrowseVideoUtils.getViewerId(d.num, visitorsettings.widgetstyle);
      this.videoViewers[c] || (this.videoViewers[c] = new AgentVideo(d.num, d.role, d.name));
    });
  }
  static removeViewers() {
    for (var a in this.videoViewers) {
      this.videoViewers[a].removeFromDOM();
    }
    this.videoViewers = {};
  }
  static numViewersOn() {
    return Object.values(this.videoViewers).filter(a => a.videostate === VideoState.ON).length;
  }
}
AgentVideo.videoViewers = {};
class VisitorVideo {
  constructor() {
    this.visitorVideoViewer = new AgentVideo("0");
  }
  show(a) {
    ssnbutton.setNWayVideoState(a);
  }
  hide() {
    ssnbutton.setBoxState(SessionButton.BOXSTATE_VIDEO);
  }
}
function TermsDialog() {
  this.scrim = getElement("#glance_scrim");
  this.terms = getElement("#glance_terms");
  this.terms.getElement("glance-video-preview") && (this.videopreview = this.terms.getElement("glance-video-preview").elem);
  this.terms.makeDialog("#glance_decline", () => {
    this.show(!1);
    presenceFire("terms", {status:"declined"});
  });
  this.terms.getElement("#glance_accept").addEvent("click", a => {
    a.preventDefault();
    presenceFire("terms", {status:"accepted"});
    this.startparams.video && this.showvideopreview && (Object.assign(this.startparams, this.videopreview.getCameraSettings()), this.startparams.videopaused ? ssnbutton.visitorVideoPaused(!0) : this.startparams.glanceVideo = this.videopreview.shutdownPreview(!0));
    GLANCE.Cobrowse.Visitor.startSession(this.startparams);
    this.show(!1);
  });
  this.terms.getElement("#glance_terms_link").addEvent("click", () => {
    var a = this.terms.getElement("#glance_terms .data");
    a = getComputedStyle(a.elem, ":before").getPropertyValue("content");
    a = "none" === a ? null : a.replace(/['"]/g, "");
    window.open(cbscripttag.termsurl || a || "https://" + cbscripttag.webServer + "/terms/?groupid=" + cbscripttag.currentGroupId, "_blank", "width=800,height=800,top=10,left=10,scrollbars=1");
  });
}
TermsDialog.prototype.show = function(a, b) {
  GLANCE.Cobrowse.Visitor.inSession() || (this.scrim.show(a), a ? (this.startparams = b || {}, (this.showvideopreview = this.startparams.video && "off" !== this.startparams.video && "GLANCE_KEYTYPE_RANDOM" !== this.startparams.sessionKey) ? (this.videopreview || console.error("ERR_NO_NWAYVIDEO"), getElement(this.videopreview).show(), this.terms.getElement("#glance_accept").elem.disabled = !0, this.videopreview.setupPreview().then(() => {
    this.terms.getElement("#glance_accept").elem.disabled = !1;
    this.terms.trapFocusInDialog();
  }).catch(() => {
    this.terms.getElement("#glance_accept").elem.disabled = !1;
    this.terms.trapFocusInDialog();
  })) : this.videopreview && getElement(this.videopreview).hide(), this.terms.showDialog(!0, this.showvideopreview)) : (this.videopreview && this.videopreview.shutdownPreview(), this.terms.hide()));
};
function processFile(a) {
  return new Promise((b, d) => {
    d = new FileReader;
    d.onload = c => {
      b(c.target.result);
    };
    d.readAsBinaryString(a);
  });
}
function handleSharedFile(a, b) {
  processFile(a).then(d => {
    var c = null;
    a.name.match(".csv|.xls|.xlsx") ? (c = "viewXLS", 5 < a.size / 1048576 && (getElement("#glance_file_too_large").addClass("glance_hide"), document.getElementById("glance_file_confirm").disabled = !0)) : a.name.match(".pdf") && (c = "viewPDF");
    c ? (b || GLANCE.Cobrowse.Visitor.sendDocument(a), b ? b.contentWindow.GLANCE.Cobrowse.Visitor[c]({data:d, preview:!0}) : GLANCE.Cobrowse.Visitor[c]({data:d, name:a.name, visitorselected:!0})) : doclog("can't process ", a.name);
  });
}
class docShareTerms {
  constructor(a) {
    this.messageBoxes = a;
    this.docshareterms = getElement("#glance_filepicker_terms");
    this.docshareterms.makeDialog("#glance_file_terms_accept", () => {
      UIState.set(UIState.DOCSHARETERMSACCEPTED, !0);
      this.messageBoxes.hideMessage();
      this.messageBoxes.showFilePicker();
      this.onPreviewConfirm();
    }, "#glance_file_terms_decline", () => {
      this.onPreviewCancel();
      this.messageBoxes.hideMessage();
    });
  }
  hide() {
    this.docshareterms.hide();
  }
  showDialog(a) {
    this.onConfirm = a.onconfirm;
    this.onCancel = a.oncancel;
    this.onPreviewConfirm = a.onpreviewconfirm;
    this.onPreviewCancel = a.onpreviewcancel;
    this.docshareterms.showDialog();
  }
}
function MessageBoxes() {
  this.msgboxcontainer = document.createElement("div");
  this.msgboxcontainer.innerHTML = MessageBoxes.html;
  document.body.appendChild(this.msgboxcontainer);
  this.docshareterms = new docShareTerms(this);
  this.msgbox = getElement("#glance_msg_box");
  this.scrim = getElement("#glance_scrim");
  this.filepicker = getElement("#glance_filepicker");
  this.filedownloading = getElement("#glance_filedownloading");
  this.navassistmessage = getElement("#glance_nav_assist");
  this.filepicker.getElement("#glance_launch_filepicker").addEvent("click", () => {
    this.filepicker.getElement("#glance_cbfile").elem.click();
  });
  this.confirmation = new Confirmation;
  this.msgbox.makeDialog("#glance_msg_ok", () => {
    this.msgbox.onOK && (this.msgbox.onOK(), delete this.msgbox.onOK);
    this.hideMessage();
  });
  this.filepicker.makeDialog("#glance_file_cancel", () => {
    this.docshareterms.onPreviewCancel();
    doclog("cancel callback");
    this.hideMessage();
  }, "#glance_file_confirm", () => {
    this.docshareterms.onConfirm();
    handleSharedFile(this.filepicker.selectedFile);
    this.hideMessage();
  });
  this.filedownloading.makeDialog("#glance_closedownloadingmodal", () => {
    this.hideMessage();
  });
  this.navassistmessage.makeDialog("#glance_nav_decline", () => {
    this.hideMessage();
  }, "#glance_nav_accept", a => {
    this.navassistmessage.onNavAssistAccepted();
  });
}
MessageBoxes.prototype.configure = function(a) {
  this.widgetstyle = a.widgetstyle;
  this.confirmation.widgetstyle = this.widgetstyle;
  this.msgboxcontainer.className = `glance_${this.widgetstyle}`;
  if ("original" === this.widgetstyle) {
    this.msgboxcontainer.className = "glance_ui_36", getElement("#glance_msg_ok").text("");
  } else {
    a = {"#glance_msg_ok":"button-message-ok", "#glance_confirm_primary_button":"button-yes", "#glance_confirm_secondary_button":"button-no", "#docshare-loading-header":"docshare-loading-header", "#docshare-disclaimer":"docshare-disclaimer", "#glance_docshare_terms_link":"terms-link", "#glance_file_terms_accept":"button-accept", "#glance_file_terms_decline":"button-decline", "#glance_nav_accept":"button-accept", "#glance_nav_decline":"button-decline", "#docshare-header":"docshare-disclaimer-header", 
    "#glance_dragdrop_msg":"docshare-drag-instructions", "#docshare-or":"docshare-or", "#glance_launch_filepicker":"docshare-filepicker", "#glance_invalid_file":"docshare-invalid-file", "#glance_file_too_large":"docshare-file-too-large", "#glance_file_confirm":"docshare-accept", "#nav_assist_title":"nav-assist", "#glance_file_cancel":"docshare-cancel", "#glance_downloading_msg":"docshare-loading"};
    for (const b in a) {
      getElement(b).text(visitorText[a[b]]);
    }
    getElement("#glance_docshare_terms_link").elem.href = visitorText["docshare-termsurl"];
  }
};
MessageBoxes.html = "\n            <div id='glance_scrim' tabindex='-1' class='glance_dim glance_hide'></div>\n            <div id='glance_msg_box' aria-labelledby='glance_msg_box' class='glance_hide glance_ui glance_popupmsg'><p id='glance_msg'></p><button id='glance_msg_ok'>OK</button></div>\n            <div id='glance_confirm' role='alertdialog' aria-labelledby='glance_confirm_msg' class='glance_hide glance_ui glance_popupmsg glance_norc'>\n                <strong id='glance_confirm_msg_header'>\n                </strong>\n                <p id='glance_confirm_msg'>\n                </p>\n                <button id='glance_confirm_primary_button'></button>\n                <button id='glance_confirm_secondary_button' class='secondary_btn'></button>\n            </div>\n\n            <div id='glance_filedownloading' role='alertdialog' aria-labelledby='docshare-loading-header' class='glance_hide glance_ui glance_popupmsg glance_norc'>\n                <button id='glance_closedownloadingmodal' class=\"\"></button>   \n                <h5 id='docshare-loading-header'></h5>\n                <p id='glance_downloading_msg'></p>\n                <div class=\"glance_spinner\">\n\t\t\t\t\t<div class=\"glance_bounce1\"></div>\n\t\t\t\t\t<div class=\"glance_bounce2\"></div>\n\t\t\t\t\t<div class=\"glance_bounce3\"></div>\n\t\t\t\t</div>\n            </div>\n\n            <div id='glance_filepicker_terms' aria-labelledby='docshare-disclaimer' class='glance_hide glance_msg glance_ui glance_popupmsg' role=\"alertdialog\" aria-modal=\"true\">\n\t\t\t    <div>\n\t\t\t\t    <p id='docshare-disclaimer'></p>\n\t\t\t\t    <a target=\"_blank\" id='glance_docshare_terms_link' href=\"\"></a>\n\t\t\t    </div>\n\t\t\t    <button id='glance_file_terms_accept' class=\"primary_btn\"></button>\n\t\t\t    <button id='glance_file_terms_decline' class='secondary_btn'></button>\n\t\t    </div>\n            \n            <div id=\"glance_nav_assist\" aria-labelledby='nav_assist_title' class='glance_hide glance_msg glance_ui glance_popupmsg' role=\"alertdialog\" aria-modal=\"true\"> \n                <h4 id=\"nav_assist_title\"> </h4>\n                <p id=\"glance_nav_assist_link_name\">  </p>\n                \n\t\t\t    <button id='glance_nav_accept' class=\"primary_btn\"></button>\n\t\t\t    <button id='glance_nav_decline' class='secondary_btn'></button>\n            </div>\n\n\t\t    <div id='glance_filepicker' aria-labelledby='glance_msg_box' class='glance_hide glance_msg glance_ui glance_popupmsg' role=\"alertdialog\" aria-modal=\"true\">\n\t\t\t    <div id=\"glance_filepicker_header\">\n\t\t\t\t    <h2 id='docshare-header'></h2>\n\t\t\t\t    <button id=\"glance_close_filepicker\" aria-labelledby=\"glance_file_cancel\"></button>\n\t\t\t    </div>\n\n\t\t\t    <div id=\"glance_select_file\">\n\t\t\t\t    <div id=\"glance_filepicker_wrapper\" class=\"glance_drop_zone\">\n\t\t\t\t\t    <p id=\"glance_dragdrop_msg\"></p>\n\t\t\t\t\t    <input style=\"display:none;\" type='file' name='glance_cbfile' id='glance_cbfile' accept=\".pdf, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel\" aria-describedby=\"glance_invalid_file\">\n\t\t\t\t    </div>\n\t\t\t\t    <p id='docshare-or'></p>\n\t\t\t\t    <button id=\"glance_launch_filepicker\" aria-describedby=\"glance_invalid_file\"></button>\n\t\t\t\t    <p id=\"glance_invalid_file\" class=\"glance_hide\"></p>\n\t\t\t    </div>\n\n\t\t\t    <div id=\"glance_file_selected\" class=\"glance_hide\">\n\t\t\t\t    <p id=\"glance_selectedfile_name\" class=\"glance_masked\"> </p>\n\t\t\t\t    <iframe id=\"glance_documentpreviewframe\"></iframe>\n\t\t\t\t    <p id=\"glance_file_too_large\" class=\"glance_hide\"></p>\n\t\t\t\t    <button id='glance_file_confirm' class=\"primary_btn\"></button>\n\t\t\t\t    <button id='glance_file_cancel' class='secondary_btn'></button>\n\t\t\t    </div>\n\t\t    </div>\n        ";
MessageBoxes.prototype.showMessage = function(a, b, d) {
  this.msgbox.onOK = d;
  this.scrim.show();
  a && (this.msgClass = a, this.msgbox.addClass(a));
  "original" === this.widgetstyle && a || this.msgbox.getElement("#glance_msg").text(b);
  this.msgbox.showDialog();
};
MessageBoxes.prototype.handleFileSelected = function(a) {
  CobrowseVideoUtils.validFile(a) ? (!CobrowseVideoUtils.validSize(a) && GLANCE.Cobrowse.Visitor.canSendDocument() && this.filepicker.getElement("#glance_file_too_large").removeClass("glance_hide"), this.filepicker.selectedFile = a, this.filepicker.getElement("#glance_selectedfile_name").text(this.filepicker.selectedFile.name), this.filepicker.addClass("previewing"), handleSharedFile(a, document.getElementById("glance_documentpreviewframe"))) : (this.filepicker.getElement("#glance_invalid_file").removeClass("glance_hide"), 
  this.filepicker.getElement("#glance_launch_filepicker").elem.setAttribute("aria-invalid", "true"));
};
MessageBoxes.prototype.showFilePicker = function() {
  this.scrim.show();
  document.querySelector("#glance_cbfile").onchange = a => {
    this.handleFileSelected(a.target.files[0]);
  };
  document.querySelector(".glance_drop_zone").ondragover = a => {
    a.preventDefault();
  };
  document.querySelector(".glance_drop_zone").ondrop = a => {
    doclog("File(s) dropped");
    a.preventDefault();
    a.dataTransfer.items && this.handleFileSelected(a.dataTransfer.files[0]);
  };
  this.filepicker.getElement("#glance_close_filepicker").addEvent("click", a => {
    this.docshareterms.onPreviewCancel();
    this.hideMessage();
  });
  this.filepicker.showDialog();
};
MessageBoxes.prototype.hideMessage = function() {
  this.msgbox.hide();
  this.msgClass && (this.msgbox.removeClass(this.msgClass), delete this.msgClass);
  this.msgbox.getElement("#glance_msg").text("");
  this.scrim.hide();
  this.confirmation.hide();
  this.filepicker.hide();
  this.filepicker.getElement("#glance_cbfile").elem.value = null;
  this.filepicker.getElement("#glance_selectedfile_name").elem.innerHTML = "";
  this.filepicker.selectedFile = null;
  this.filepicker.getElement("#glance_select_file").removeClass("glance_hide");
  this.filepicker.removeClass("previewing");
  this.filepicker.getElement("#glance_file_selected").addClass("glance_hide");
  document.getElementById("glance_file_confirm").disabled = !1;
  var a = this.filepicker.getElement("#glance_documentpreviewframe"), b = a.elem.contentWindow.document.getElementById("glance_pdfviewer");
  a = a.elem.contentWindow.document.getElementById("glance_xlsviewer");
  b && (b.outerHTML = "");
  a && (a.outerHTML = "");
  this.filepicker.getElement("#glance_invalid_file").addClass("glance_hide");
  this.filepicker.getElement("#glance_launch_filepicker").elem.removeAttribute("aria-invalid");
  this.filepicker.getElement("#glance_file_too_large").addClass("glance_hide");
  this.docshareterms.hide();
  this.filedownloading.hide();
  this.navassistmessage.hide();
};
var IN_SESSION = 1, NOT_IN_SESSION = 2, SESSION_STARTING = 3, SESSION_BLURRED = 4, IN_SESSION_DISCON = 5, buttonStateClasses = ";in_session;not_in_session;session_starting;in_session_blurred;in_session discon".split(";");
function SessionButton(a) {
  if (a.includes("<script")) {
    throw Error("ERR_UNSAFE_BUTTON_HTML");
  }
  if (document.body) {
    var b = document.createElement("div");
    b.innerHTML = a;
    document.body.append(...Array.from(b.children));
    this.button = getElement("#glance_cobrowse_btn");
    this.setState(NOT_IN_SESSION);
    this.startlabel = getElement("#glance_start_label");
    this.border = getElement("#glance_border");
    this.announcementpill = getElement("#glance_agentviewing");
    this.accessiblitystatus = getElement("#glance_accessibility_status");
    this.videopreview = this.button.getElement("#glance_ssnkey_box glance-video-preview");
    this.videosessionpreview = getElement("#glance_videopreviewcontainer");
    this.ssnkeybox = this.button.getElement("#glance_ssnkey_box");
    a = "original" === messageboxes.confirmation.widgetstyle;
    "alertdialog" === this.ssnkeybox.elem.getAttribute("role") && this.ssnkeybox.makeDialog("#glance_cancel_btn", () => {
      this.confirmStopSession();
    }, void 0, void 0, a);
    this.addEventListeners();
    this.visitorVideoBlurred = !1;
    SessionButton.created();
  } else {
    console.error("ERR_NO_BODY");
  }
}
SessionButton.prototype.focus = function() {
  this.button.focus();
};
SessionButton.prototype.announceAccessibilityStatus = function(a) {
  if (this.accessiblitystatus) {
    var b = this.accessiblitystatus.getElement("p");
    uilog("Announcing:", a);
    b.textContent = a;
  }
};
SessionButton.prototype.handlePlayerTooSlow = function() {
  this.cantPlayVideoDisplayed || (this.showAnnouncementPill(!0, visitorText["cant-play-video"]), this.cantPlayVideoDisplayed = !0);
};
SessionButton.prototype.showAnnouncementPill = function(a, b) {
  this.announcementpill && (this.announcementpill.elem.textContent = b || "", a && (this.announcementpill.removeClass("glance-announcement-pill"), window.setTimeout(() => {
    this.announcementpill.addClass("glance-announcement-pill");
  }), window.setTimeout(() => {
    this.announcementpill.show(!1);
  }, 5000), this.announceAccessibilityStatus(b)), this.announcementpill.show(a));
};
SessionButton.prototype.setNWayVideoState = function(a) {
  this.button.setAttr("data-videosize", a.video);
  getElement("#glance_resize_video").setAttr("aria-expanded", "small" !== a.video);
  visitorsettings.videobgblurallowed && visitorsettings.videobgblurtoggle || getElement("#glance_blurbgd_video").hide();
  this.setBoxState(SessionButton.BOXSTATE_NWAYVIDEO);
};
SessionButton.prototype.showDisconnected = function(a) {
  a ? this.setState(IN_SESSION_DISCON) : this.state === IN_SESSION_DISCON && this.setState(IN_SESSION);
};
SessionButton.prototype.refreshFocusTrap = function() {
  var a = document.getElementById("glance_cancel_btn"), b = a.cloneNode(!0);
  a.parentNode.replaceChild(b, a);
  handleMouseDown(getElement("#glance_cancel_btn"), () => {
    this.confirmStopSession();
  });
  a = Array.from(this.ssnkeybox.elem.querySelectorAll("a, input, button, select")).filter(d => null !== d.offsetParent);
  1 <= a.length && (getElement(a[0]).trapFocus(!0), getElement(a[a.length - 1]).trapFocus(!1));
};
function handleMouseDown(a, b) {
  a && a.addEvent("click", d => {
    d.preventDefault();
    0 === d.button && b();
  });
}
SessionButton.prototype.supportsDrag = function() {
  return "original" !== visitorsettings.widgetstyle && document.getElementById("glance_titlebar");
};
SessionButton.prototype.makeDraggable = function() {
  if (this.supportsDrag()) {
    a(document.getElementById("glance_session_widget"));
    function a(b) {
      function d(h) {
        h = h || window.event;
        h.preventDefault();
        e = k - h.clientX;
        f = g - h.clientY;
        k = h.clientX;
        g = h.clientY;
        ssnbutton.draggingWidget({bottom:f, left:0 - e});
      }
      function c() {
        ssnbutton.restoreWidgetPos(!0);
        document.removeEventListener("mouseup", c);
        document.removeEventListener("mousemove", d);
      }
      b = document.getElementById("glance_titlebar");
      var e = 0, f = 0, k = 0, g = 0;
      b.addEventListener("mousedown", function(h) {
        h.target.matches("button") || (h = h || window.event, h.preventDefault(), k = h.clientX, g = h.clientY, document.addEventListener("mouseup", c), document.addEventListener("mousemove", d));
      });
      b.addEventListener("touchmove", function(h) {
        h.preventDefault();
        h = h.targetTouches[0];
        h = {x:h.clientX, y:h.clientY};
        this.lasttouchcoords && ssnbutton.draggingWidget({bottom:this.lasttouchcoords.y - h.y, left:h.x - this.lasttouchcoords.x, });
        this.lasttouchcoords = h;
      });
      b.addEventListener("touchend", function(h) {
        this.lasttouchcoords = null;
        ssnbutton.restoreWidgetPos(!0);
      });
    }
  }
};
SessionButton.prototype.addEventListeners = function() {
  handleMouseDown(getElement("#glance_cancel_btn"), () => {
    this.confirmStopSession();
  });
  handleMouseDown(getElement("#glance_show_btn"), () => {
    GLANCE.Cobrowse.Visitor.startSession();
  });
  handleMouseDown(getElement("#glance_stop_btn"), () => {
    this.confirmStopSession();
  });
  handleMouseDown(getElement("#glance_blurbgd_video"), () => {
    this.setVideoBgBlurState(!this.visitorVideoBlurred);
    GLANCE.Cobrowse.Visitor.setVideoBgFilterActive(this.visitorVideoBlurred);
  });
  handleMouseDown(getElement("#glance_resize_video"), () => {
    GLANCE.Cobrowse.Visitor.toggleVideoSize();
  });
  handleMouseDown(getElement("#glance_stop_video"), () => {
    this.toggleVideo();
  });
  handleMouseDown(getElement("#glance_expand"), () => {
    this.setExpanded(!UIState.get(UIState.EXPANDED));
    UIState.get(UIState.EXPANDED) ? this.restoreWidgetPos() : this.restoreWidgetPos(!0);
  });
  handleMouseDown(getElement("#glance_scroll-left"), () => {
    this._doVideoScroll(!1);
  });
  handleMouseDown(getElement("#glance_scroll-right"), () => {
    this._doVideoScroll(!0);
  });
  window.addEventListener("resize", a => {
    uilog("moving widget on resize");
    this.restoreWidgetPos();
  });
  this.videopreview && this.videopreview.elem.addEventListener("settingschange", a => {
    GLANCE.Cobrowse.Visitor.loaded && GLANCE.Cobrowse.Visitor.setCameraSettings(a.target.getCameraSettings());
  });
};
SessionButton.prototype.setState = function(a) {
  this.state = a;
  for (var b = buttonStateClasses.length - 1; 0 <= b; b--) {
    this.button.removeClass(buttonStateClasses[b]);
  }
  this.button.addClass(buttonStateClasses[a]);
};
SessionButton.prototype.showAgentJoined = function(a) {
  var b = parseInt(this.button.getAttr("data-viewercount"));
  b && b < a.count && (b = a.agentlist[a.count - 1], "guest" === b.role && ssnbutton.showAnnouncementPill(!0, visitorText["viewer-joined-pill"].replaceAll("${name}", b.name)));
  this.button.setAttr("data-viewercount", a.agentlist.length);
  this.border.addClass("joined");
  this.videopreview && GLANCE.Cobrowse.Visitor.setGlanceVideoSource(this.videopreview.elem.shutdownPreview(!0));
};
SessionButton.prototype.setVideoBgBlurState = function(a) {
  this.visitorVideoBlurred = a;
  this.videosessionpreview.setAttr("data-videobgblur-0", this.visitorVideoBlurred);
  getElement("#glance_blurbgd_video").setAttr("aria-pressed", `${this.visitorVideoBlurred}`);
  getElement("#glance_blurbgd_video").setAttr("aria-label", this.visitorVideoBlurred ? "Unblur Background" : "Blur Background");
};
SessionButton.prototype.toggleVideo = function() {
  this.button.getElement("#glance_stop_video").elem.disabled = !0;
  this.getVideoParticipantState(0) === VideoState.ON ? this.setVideoParticipantState(0, VideoState.PAUSED) : this.setVideoParticipantState(0, VideoState.ON);
  GLANCE.Cobrowse.Visitor.toggleVideo();
};
SessionButton.prototype.visitorVideoPaused = function(a) {
  this.button.getElement("#glance_stop_video").elem.disabled = !1;
  this.setVideoParticipantState(0, a ? VideoState.PAUSED : VideoState.ON);
};
SessionButton.prototype.showStarting = function() {
  uilog("SessionButton.showStarting");
  messageboxes.hideMessage();
  termsdialog && termsdialog.show(!1);
  this.setState(SESSION_STARTING);
  this.setBoxState(SessionButton.BOXSTATE_STARTING);
  this.setExpanded(!0);
};
SessionButton.prototype.showInSession = function() {
  this.videopreview && this.videopreview.hide();
  UIState.get(UIState.RCENABLED) && this.border.addClass("glance_rcenabled");
  "original" !== messageboxes.confirmation.widgetstyle && getElement("#glance_key_prompt").text(visitorText["ssn-key-prompt"]);
  getElement("#glance_ssn_key").text(GLANCE.Cobrowse.Visitor.getKey());
  uilog("showInSession setting box state to:", UIState.get(UIState.BOXSTATE), "expanded:", UIState.get(UIState.EXPANDED));
  this.setBoxState(UIState.get(UIState.BOXSTATE));
  this.setExpanded(UIState.get(UIState.EXPANDED));
  if (UIState.get(UIState.BOXSTATE) < SessionButton.BOXSTATE_JOINED) {
    "alertdialog" === this.ssnkeybox.elem.getAttribute("role") && this.ssnkeybox.showDialog(!1);
    var a = GLANCE.Cobrowse.Visitor.getStartParams();
    (a = a && a.video) && "off" !== a && GLANCE.Cobrowse.Visitor.isRandomKey() && (this.videopreview || console.error("ERR_NO_NWAYVIDEO"), this.boxstate < SessionButton.BOXSTATE_KEYED && this.setBoxState(SessionButton.BOXSTATE_KEYEDWAITCAMERA), this.videopreview.show(), this.videopreview.elem.setupPreview().then(() => {
      GLANCE.Cobrowse.Visitor.setCameraSettings(this.videopreview.elem.getCameraSettings());
    }).catch(() => {
    }).finally(() => {
      !GLANCE.Cobrowse.Visitor.inSession() || UIState.get(UIState.BOXSTATE) >= SessionButton.BOXSTATE_JOINED || (this.refreshFocusTrap(), this.setBoxState(SessionButton.BOXSTATE_KEYED));
    }));
  }
  this.setState(IN_SESSION);
  ssnbutton.restoreWidgetPos();
};
let VideoState = {ON:"on", PAUSED:"paused", BLOCKED:"blocked", NOTSUPPORTED:"notsupported", ERROR:"error"};
SessionButton.BoxStates = "starting integrated keyedwaitcamera keyed joined video nwayvideo".split(" ");
SessionButton.BOXSTATE_STARTING = 0;
SessionButton.BOXSTATE_INTEGRATED = 1;
SessionButton.BOXSTATE_KEYEDWAITCAMERA = 2;
SessionButton.BOXSTATE_KEYED = 3;
SessionButton.BOXSTATE_JOINED = 4;
SessionButton.BOXSTATE_VIDEO = 5;
SessionButton.BOXSTATE_NWAYVIDEO = 6;
SessionButton.prototype.setBoxState = function(a) {
  ["#glance_ssnkey_box", "#glance_cobrowse_btn"].forEach(b => {
    let d = getElement(b);
    d && (SessionButton.BoxStates.forEach(function(c) {
      d.removeClass(c);
    }), 0 <= a && d.addClass(SessionButton.BoxStates[a]), a === SessionButton.BOXSTATE_VIDEO && this.button.setAttr("data-videosize", "small"));
  });
  this.boxstate = a;
  UIState.set(UIState.BOXSTATE, a);
};
SessionButton.prototype.nwayVideoMode = function() {
  return this.boxstate == SessionButton.BOXSTATE_NWAYVIDEO;
};
SessionButton.prototype.showJoinPrompt = function() {
  var a = GLANCE.Cobrowse.Visitor.getStartParams();
  a = a && a.video && "off" !== a.video;
  this.videopreview && this.videopreview.hide();
  getElement("#glance_ssn_key").text(GLANCE.Cobrowse.Visitor.getKey());
  this.setBoxState(GLANCE.Cobrowse.Visitor.isRandomKey() ? a ? SessionButton.BOXSTATE_KEYEDWAITCAMERA : SessionButton.BOXSTATE_KEYED : SessionButton.BOXSTATE_INTEGRATED);
  this.setExpanded(!0);
  this.setState(IN_SESSION);
};
SessionButton.prototype.showSessionStopped = function() {
  this.setExpanded(!1);
  this.setState(NOT_IN_SESSION);
  this.setBoxState(-1);
  this.clearButtonState();
};
SessionButton.prototype.confirmStopSession = function() {
  "original" === messageboxes.confirmation.widgetstyle ? GLANCE.Cobrowse.Visitor.stopSession() : messageboxes.confirmation.show("", visitorText["end-session-prompt"], () => {
    GLANCE.Cobrowse.Visitor.stopSession();
    this.ssnkeybox.previousFocus && this.ssnkeybox.previousFocus.focus();
  });
};
SessionButton.prototype.clearButtonState = function() {
  this.videopreview && this.videopreview.elem.shutdownPreview();
  this.border.removeClass("joined");
  this.button.elem.removeAttribute("data-videosize");
  this.button.elem.removeAttribute("data-viewercount");
  this.button.removeClass("viewingscreenshare");
  this.videosessionpreview && this.videosessionpreview.removeAttrs("data-videostate");
  AgentVideo.removeViewers();
};
SessionButton.prototype.setVideoParticipantState = function(a, b, d, c) {
  if (0 === a) {
    let e = this.button.getElement("#glance_stop_video");
    e.setAttr("aria-pressed", b === VideoState.ON);
    e.elem.disabled = !1;
    this.videosessionpreview.setAttr("data-videostate-0", b);
    void 0 !== d && this.setVideoBgBlurState(d);
    void 0 !== c && this.videosessionpreview.setAttr("data-videoblurcapable-0", c);
  }
  (d = this.button.getElement(`#glance_video_container_${a}`)) ? d.setAttr("data-videostate", b) : vidlog("Not setting video participant state, viewer not found:", a);
};
SessionButton.prototype.getVideoParticipantState = function(a) {
  return this.videosessionpreview && this.videosessionpreview.getAttr(`data-videostate-${a}`);
};
SessionButton.prototype._doVideoScroll = function(a) {
  a = CobrowseVideoUtils.scrollVideoStrip(a);
  UIState.set("videoscrolloffset", a);
};
SessionButton.prototype.setExpanded = function(a) {
  (a ? this.button.addClass : this.button.removeClass).call(this.button, "expanded");
  getElement("#glance_expand").setAttr("aria-expanded", a);
  UIState.set(UIState.EXPANDED, a);
  ssnbutton.restoreWidgetPos();
};
SessionButton.prototype.show = function(a) {
  this.startlabel && (this.startlabel.elem.style.display = a ? "block" : "");
};
SessionButton.prototype.toggle = function() {
  this.startlabel && this.show("" === this.startlabel.elem.style.display);
};
SessionButton.createdpromise = new Promise(a => {
  SessionButton.created = a;
});
SessionButton.prototype.restoreWidgetPos = function(a) {
  if (this.state === IN_SESSION && GLANCE.Cobrowse.Visitor.READYSTATE.statereceived && "original" !== visitorsettings.widgetstyle) {
    var b = document.getElementById("glance_session_widget");
    if (b) {
      var d = UIState.get(UIState.WIDGETPOS);
      d || (d = {bottom:!0, left:!0}, UIState.set(UIState.WIDGETPOS, d));
      uilog("restoring widget position:", d);
      var c = b.getBoundingClientRect(), e = window.innerHeight || document.documentElement.clientHeight, f = window.innerWidth || document.documentElement.clientWidth;
      b.style.transition = a ? "all .5s" : "unset";
      b.style.bottom = d.bottom ? "20px" : b.style.bottom = e - c.height - 33 - 20 + "px";
      b.style.left = d.left ? "20px" : f - c.width - 20 + "px";
      b.setAttribute("data-widget-location-bottom", d.bottom);
      b.setAttribute("data-widget-location-left", d.left);
    }
  }
};
SessionButton.prototype.draggingWidget = function(a) {
  if (this.supportsDrag() && this.state === IN_SESSION && GLANCE.Cobrowse.Visitor.READYSTATE.statereceived && "original" !== visitorsettings.widgetstyle && !ssnbutton.button.elem.matches("[data-videosize=large]")) {
    var b = document.getElementById("glance_session_widget");
    document.getElementById("glance_titlebar").getBoundingClientRect();
    var d = window.getComputedStyle(b);
    b.style.bottom = parseInt(d.bottom) + a.bottom + "px";
    b.style.left = parseInt(d.left) + a.left + "px";
    b.style.transition = "unset";
    a = b.getBoundingClientRect();
    a = {bottom:(a.top + a.bottom) / 2 > (window.innerHeight || document.documentElement.clientHeight) / 2, left:(a.left + a.right) / 2 < (window.innerWidth || document.documentElement.clientWidth) / 2};
    uilog("saving widget position:", a);
    UIState.set(UIState.WIDGETPOS, a);
  }
};
function createSessionButton(a) {
  function b(c) {
    if (c === screenshare.name) {
      return screenshare;
    }
    if (c === visitorvideo.visitorVideoViewer.name) {
      return visitorvideo.visitorVideoViewer;
    }
    if (AgentVideo.videoViewers[c]) {
      return AgentVideo.videoViewers[c];
    }
    debuglog("Unrecognized screenshareView:", c);
  }
  uilog("createSessionButton Visitor.loaded:", GLANCE.Cobrowse.Visitor.loaded, "session readystate:", GLANCE.Cobrowse.Visitor.readyState);
  if (!getElement("#glance_cobrowse_btn")) {
    ssnbutton = new SessionButton(a);
    var d = new VisitorVideoConfirmation;
    GLANCE.Cobrowse.Visitor.inSession() && ssnbutton.showInSession();
    document.addEventListener("keydown", function(c) {
      27 === c.keyCode && document.activeElement.matches("#glance_stop_btn, #glance_resize_video, #glance_stop_video, #glance_blurbgd_video, #glance_drag_handle") && (c.target.hasAttribute("data-accessibility-hidden") ? c.target.removeAttribute("data-accessibility-hidden") : c.target.setAttribute("data-accessibility-hidden", ""), c.preventDefault(), c.stopPropagation());
      if (37 <= c.keyCode && 40 >= c.keyCode && c.shiftKey && document.activeElement.matches("#glance_drag_handle")) {
        let e = UIState.get(UIState.WIDGETPOS);
        switch(c.key) {
          case "ArrowLeft":
            e.left = !0;
            break;
          case "ArrowRight":
            e.left = !1;
            break;
          case "ArrowUp":
            e.bottom = !1;
            break;
          case "ArrowDown":
            e.bottom = !0;
        }
        UIState.set(UIState.WIDGETPOS, e);
        ssnbutton.restoreWidgetPos(!0);
        ssnbutton.announceAccessibilityStatus("widget moved to " + (e.bottom ? "bottom " : "top ") + (e.left ? "left" : "right"));
      }
      "Tab" === c.key && c.shiftKey && c.target.matches('[data-videosize="large"] .firstcontrol') && c.preventDefault();
      "Tab" === c.key && !c.shiftKey && c.target.matches('[data-videosize="large"] .lastcontrol') && c.preventDefault();
    }, !1);
    GLANCE.Cobrowse.Visitor.addEventListener("agents", function(c) {
      ssnbutton.showAgentJoined(c);
      UIState.get(UIState.BOXSTATE) < SessionButton.BOXSTATE_JOINED && (ssnbutton.setBoxState(SessionButton.BOXSTATE_JOINED), ssnbutton.restoreWidgetPos(), "original" === visitorsettings.widgetstyle && ssnbutton.setExpanded(!1), GLANCE.Cobrowse.Visitor.isPageMasked() || GLANCE.Cobrowse.Visitor.isSessionPaused() || ssnbutton.showAnnouncementPill(!0, visitorText["agent-viewing-pill"]), this.videopreview && this.videopreview.elem.stop());
      AgentVideo.syncViewerList(c.agentlist);
      ssnbutton.restoreWidgetPos(!0);
    });
    GLANCE.Cobrowse.Visitor.addEventListener("reverseconfirm", function(c) {
      messageboxes.confirmation.show("glance_confirm_show", visitorText["allow-view-screen-text"], function() {
        c.accept();
      }, function() {
        c.decline();
      });
    });
    GLANCE.Cobrowse.Visitor.addEventListener("reverseended", function() {
      getElement("#glance_confirm_msg").elem.className.includes && getElement("#glance_confirm_msg").elem.className.includes("glance_confirm_show") && messageboxes.confirmation.hide();
    });
    screenshare = new Screenshare;
    GLANCE.Cobrowse.Visitor.addEventListener("sessionstarting", function() {
      assert(GLANCE.Cobrowse.Visitor.readyState === GLANCE.Cobrowse.Visitor.READYSTATE.sessionstarting);
      ssnbutton.showStarting();
      ssnbutton.announceAccessibilityStatus(visitorText["button-session-starting-text"]);
      return !0;
    });
    GLANCE.Cobrowse.Visitor.addEventListener("sessionstart", function() {
      assert(GLANCE.Cobrowse.Visitor.readyState === GLANCE.Cobrowse.Visitor.READYSTATE.sessionstart);
      ssnbutton.showJoinPrompt();
    });
    GLANCE.Cobrowse.Visitor.addEventListener("sessioncontinue", function() {
      assert(GLANCE.Cobrowse.Visitor.readyState === GLANCE.Cobrowse.Visitor.READYSTATE.sessioncontinue);
    });
    GLANCE.Cobrowse.Visitor.addEventListener("statereceived", function() {
      assert(GLANCE.Cobrowse.Visitor.readyState === GLANCE.Cobrowse.Visitor.READYSTATE.statereceived);
      uilog("getSessionState agents", GLANCE.Cobrowse.Visitor.getSessionState("agents"));
      uilog("getSessionState rc", GLANCE.Cobrowse.Visitor.getSessionState("rc"));
      uilog("getSessionState glance_screenshare", GLANCE.Cobrowse.Visitor.getSessionState("screenshare", "glance_screenshare"));
      ssnbutton.showInSession();
      CobrowseVideoUtils.setVideoScrollOffset(UIState.get("videoscrolloffset") || 0);
    });
    GLANCE.Cobrowse.Visitor.addEventListener("sessionend", function(c) {
      assert(GLANCE.Cobrowse.Visitor.readyState === GLANCE.Cobrowse.Visitor.READYSTATE.sessionend);
      "error" !== c.reason && messageboxes.hideMessage();
      ssnbutton.showSessionStopped();
      d.hide();
      screenshare.hide();
      ssnbutton.announceAccessibilityStatus(visitorText["session-ended-text"]);
      ssnbutton.showAnnouncementPill(!1);
    });
    GLANCE.Cobrowse.Visitor.addEventListener("error", function(c) {
      var e = c.msg;
      switch(c.code) {
        case "conndrop":
          e = "Could not connect to server " + c.params.server;
          break;
        case "service":
          e = e || "Unable to connect to Glance";
      }
      messageboxes.showMessage("", e);
    });
    GLANCE.Cobrowse.Visitor.addEventListener("screenshare", function(c) {
      uilog("Received screenshare event:", c);
      if (c.screenshareView !== visitorvideo.visitorVideoViewer.name || "original" === visitorsettings.widgetstyle) {
        var e = b(c.screenshareView);
        e && e.show(c);
      }
    });
    GLANCE.Cobrowse.Visitor.addEventListener("screensharepaused", function(c) {
      uilog("Received screenshare paused event:", c);
      b(c.screenshareView).pause(c);
    });
    GLANCE.Cobrowse.Visitor.addEventListener("screenshareresumed", function(c) {
      uilog("Received screenshare resumed event:", c);
      b(c.screenshareView).resume(c);
    });
    GLANCE.Cobrowse.Visitor.addEventListener("viewerinfo", function(c) {
      uilog("Received screenshare viewerinfo event:", c);
      let e = b(c.screenshareView);
      e && e.viewerinfo(c);
    });
    GLANCE.Cobrowse.Visitor.addEventListener("viewerclosing", function(c) {
      uilog("Received screenshare closing event:", c);
      b(c.screenshareView) && "PlayerTooSlow" === c.closereason && ssnbutton.handlePlayerTooSlow();
    });
    visitorvideo = new VisitorVideo;
    GLANCE.Cobrowse.Visitor.addEventListener("visitorvideorequested", function(c) {
      d.show(c.accept, c.decline);
    });
    GLANCE.Cobrowse.Visitor.addEventListener("visitorvideoerror", function() {
      vidlog("Visitor video error");
      ssnbutton.setVideoParticipantState(0, VideoState.ERROR);
    });
    GLANCE.Cobrowse.Visitor.addEventListener("videobgfilterfailed", c => {
      vidlog("Video background filtering failed");
      let e = "";
      switch(c.failuremode) {
        case "abortvideo":
          e = visitorText["video-blur-failed-abortvideo"];
          ssnbutton.setVideoParticipantState(0, VideoState.BLOCKED);
          break;
        case "abortbgfilter":
          e = visitorText["video-blur-failed-abortbgfilter"], ssnbutton.videosessionpreview.setAttr("data-videoblurcapable-0", !1);
      }
      messageboxes.showMessage("", e);
    });
    GLANCE.Cobrowse.Visitor.addEventListener("visitorvideo", function(c) {
      vidlog("Visitor video", c);
      "large" === c.video && ssnbutton.setExpanded(!0);
      visitorvideo.show(c);
      "small" === c.video && CobrowseVideoUtils.setVideoScrollOffset(UIState.get("videoscrolloffset") || 0);
      switch(c.camerastatus) {
        case "available":
          ssnbutton.getVideoParticipantState(0) || ssnbutton.setVideoParticipantState(0, VideoState.ON, c.videobgfilter, "none" !== c.videobgtype);
          break;
        case "nocamera":
        case "blocked":
        case "aborted":
          ssnbutton.setVideoParticipantState(0, VideoState.BLOCKED);
          break;
        case "notsupported":
          ssnbutton.setVideoParticipantState(0, VideoState.NOTSUPPORTED);
          break;
        case "error":
          ssnbutton.setVideoParticipantState(0, VideoState.ERROR);
      }
      ssnbutton.restoreWidgetPos();
    });
    GLANCE.Cobrowse.Visitor.addEventListener("visitorvideopaused", function(c) {
      vidlog("Visitor video paused");
      ssnbutton.visitorVideoPaused(!0);
    });
    GLANCE.Cobrowse.Visitor.addEventListener("visitorvideoresumed", function(c) {
      vidlog("Visitor video resumed");
      ssnbutton.visitorVideoPaused(!1);
    });
    GLANCE.Cobrowse.Visitor.addEventListener("blur", function() {
      uilog("Hiding button on blur");
      ssnbutton.clearButtonState();
      ssnbutton.setState(SESSION_BLURRED);
      ssnbutton.show(!1);
      ssnbutton.border.hide();
    });
    GLANCE.Cobrowse.Visitor.addEventListener("focus", function() {
      ssnbutton.showInSession();
      ssnbutton.border.show();
    });
    GLANCE.Cobrowse.Visitor.addEventListener("rcrequested", function(c) {
      function e(f) {
        return function() {
          f ? c.accept() : c.decline();
        };
      }
      messageboxes.confirmation.show("glance_confirm_rc", c.selective ? visitorText["ce-prompt-text"] : visitorText["rc-prompt-text"], e(!0), e(!1));
    });
    GLANCE.Cobrowse.Visitor.addEventListener("visitorscreensharerequested", function(c) {
      messageboxes.confirmation.show("glance_confirm_screenshare", visitorText["visitor-screenshare-request-msg"], c.accept, c.decline, visitorText["visitor-screenshare-request-title"], visitorText["button-accept"], visitorText["button-decline"]);
    });
    GLANCE.Cobrowse.Visitor.addEventListener("visitorscreensharesurfacenotallowed", function(c) {
      messageboxes.confirmation.show("glance_confirm_screenshare", visitorText["visitor-screenshare-surface-not-allowed-msg"], c.accept, c.decline);
    });
    GLANCE.Cobrowse.Visitor.addEventListener("docsharerequested", function(c) {
      messageboxes.scrim.show();
      UIState.get(UIState.DOCSHARETERMSACCEPTED) ? messageboxes.showFilePicker() : messageboxes.docshareterms.showDialog(c);
    });
    GLANCE.Cobrowse.Visitor.addEventListener("navassistrequested", function(c) {
      messageboxes.scrim.show();
      messageboxes.navassistmessage.onNavAssistAccepted = () => {
        c.accept().then(e => {
          ssnbutton.button.elem.matches("[data-videosize=large]") && GLANCE.Cobrowse.Visitor.toggleVideoSize();
          messageboxes.hideMessage();
          window.location = e;
        });
      };
      messageboxes.navassistmessage.getElement("#glance_nav_assist_link_name").elem.innerText = c.name;
      messageboxes.navassistmessage.showDialog(c);
    });
    GLANCE.Cobrowse.Visitor.addEventListener("filedownloading", function(c) {
      messageboxes.scrim.show();
      messageboxes.filedownloading.showDialog();
    });
    GLANCE.Cobrowse.Visitor.addEventListener("filedownloaded", function(c) {
      messageboxes.hideMessage();
    });
    GLANCE.Cobrowse.Visitor.addEventListener("confirm", function(c) {
      messageboxes.confirmation.show(`glance_confirm_${c.confirm}`, visitorText[`confirm-${c.confirm}`], c.accept);
    });
    GLANCE.Cobrowse.Visitor.addEventListener("rc", function(c) {
      (c.enabled ? ssnbutton.border.addClass : ssnbutton.border.removeClass).call(ssnbutton.border, "glance_rcenabled");
      UIState.get(UIState.RCENABLED) !== c.enabled && (ssnbutton.showAnnouncementPill(!0, c.enabled ? visitorText["agent-controlling-pill"] : visitorText["agent-viewing-pill"]), ssnbutton.announceAccessibilityStatus(c.enabled ? visitorText["rc-started-text"] : visitorText["rc-ended-text"]));
      UIState.set(UIState.RCENABLED, c.enabled);
    });
    GLANCE.Cobrowse.Visitor.addEventListener("connection", function(c) {
      ssnbutton.showDisconnected("reconnecting" === c.status);
    });
    GLANCE.Cobrowse.Visitor.addEventListener("urlstartwarning", function(c) {
      messageboxes.confirmation.show("glance_confirm_xd", visitorText["cross-domain-continue-text"], c.accept, c.decline);
    });
    GLANCE.Cobrowse.Visitor.addEventListener("widgetmoving", c => {
      ssnbutton.draggingWidget(c);
    });
    GLANCE.Cobrowse.Visitor.addEventListener("widgetmoved", c => {
      var e = UIState.get(UIState.WIDGETPOS);
      c && (c.hasOwnProperty("left") && (e.left = c.left), c.hasOwnProperty("bottom") && (e.bottom = c.bottom), UIState.set(UIState.WIDGETPOS, e));
      ssnbutton.announceAccessibilityStatus("widget moved to " + (e.bottom ? "bottom " : "top ") + (e.left ? "left" : "right"));
      ssnbutton.restoreWidgetPos(!0);
    });
    ssnbutton.makeDraggable();
    (a = GLANCE.Cobrowse.Loader && GLANCE.Cobrowse.Loader._onload.VisitorUI) && a();
    GLANCE.Cobrowse.Loader.setUIReady();
  }
}
var SessionParams, VideoParams;
function initAPI(a) {
  GLANCE.Cobrowse.VisitorUI.VERSION = "6.1.1.5";
  GLANCE.Cobrowse.VisitorUI.loaded = !0;
  GLANCE.Cobrowse.VisitorUI.setStyle = function(b) {
    cbscripttag.addStylesheets(b);
  };
  GLANCE.Cobrowse.VisitorUI.showButton = function(b) {
    void 0 === b && (b = !0);
    SessionButton.createdpromise.then(() => ssnbutton.show(b));
  };
  GLANCE.Cobrowse.VisitorUI.toggleButton = function() {
    SessionButton.createdpromise.then(() => ssnbutton.toggle());
  };
  GLANCE.Cobrowse.VisitorUI.showTerms = function(b) {
    (b = b || {}, b.groupid) && cbscripttag.addStylesheets(b.groupid);
    b = cbscripttag.coalesceSessionStartParams(a, b);
    presenceFire("terms", {status:"displayed"});
    termsdialog = termsdialog || new TermsDialog;
    termsdialog.show(!0, b);
  };
  GLANCE.Cobrowse.VisitorUI.promptCrossDomain = function(b) {
    return !GLANCE.Cobrowse.Visitor.inSession() || GLANCE.Cobrowse.Visitor.isCrossDomainDone() ? Promise.resolve() : new Promise(function(d, c) {
      messageboxes.confirmation.show("glance_confirm_xd", visitorText["cross-domain-continue-text"], () => {
        GLANCE.Cobrowse.Visitor.crossDomain(b).then(function(e) {
          d(e);
        });
      }, () => {
      }, "", visitorText["button-accept"], visitorText["button-decline"]);
    });
  };
}
function visitorScriptLoaded() {
  return new Promise(a => {
    if (GLANCE.Cobrowse.Visitor.loaded) {
      a();
    } else {
      var b = document.getElementById("glance_visitor");
      b ? (b.addEventListener("load", a), uilog("Waiting for visitor script to load")) : a();
    }
  });
}
GLANCE.Cobrowse.VisitorUI = GLANCE.Cobrowse.VisitorUI || {};
GLANCE.Cobrowse.VisitorUI.ready = function() {
  return SessionButton.createdpromise;
};
getDocument().onLoad(() => {
  uilog("onLoad");
  getVisitorUISettings().then(a => {
    initAPI(a);
    visitorsettings = a;
    cbscripttag.setCustomizationVersion(a.custver);
    let b = cbscripttag.addStylesheets(a.settingsparentgroupid), d = cbscripttag.addGlanceVideo(a.videobgblurallowed);
    return Promise.all([b, getButtonHTML(a), getButtonText(a), visitorScriptLoaded(), d]);
  }).then(a => {
    uilog("Generating button");
    visitorText = a[2];
    visitorText["docshare-termsurl"] = visitorsettings.docsharetermsurl;
    visitorText.companyname = visitorsettings.companyname;
    messageboxes = new MessageBoxes;
    messageboxes.configure(visitorsettings);
    return replaceButtonText(a[1], a[2]);
  }).then(a => {
    createSessionButton(a);
  });
});
}).call(window);
