/*
 Copyright 2022 Glance Networks, Inc.
*/
'use strict';
var GLANCE_LOGGER = !0, GlanceLogger = {sanitize:function(a) {
  return a.replace(/[\r\n]/g, " ").replace("<", "&lt;");
}, _log:function(a, ...c) {
  !window.console || !window.console[a] || window.GLANCE_COBROWSE && window.GLANCE_COBROWSE.disableLogging || (c = c.map(e => {
    if ("object" === typeof e) {
      try {
        e = JSON.stringify(e);
      } catch (d) {
        console.error(d), e = "unable to convert object to string";
      }
    }
    return "string" === typeof e ? GlanceLogger.sanitize(e) : e;
  }), window.console[a](...c));
}, log:function(...a) {
  GlanceLogger._log("log", ...a);
}, error:function(...a) {
  GlanceLogger._log("error", ...a);
}}, LOG_DIFFS = !1, LOG_DIFFDET = !1, LOG_DRAW = !1, LOG_PRES = !0, LOG_CBSTATE = !1, LOG_IFRAME = !1, LOG_SCROLL = !1, LOG_EVENTS = !1, LOG_LOADER = !1, LOG_UI = !1, LOG_FOCUS = !1, LOG_XDOM = !0, LOG_C3P = !1, LOG_PDF = !1, LOG_STYLES = !1, LOG_GEST = !1, LOG_MSG = !1, LOG_RES = !1, LOG_RC = !1, LOG_SD = !1, LOG_VID = !0, LOG_MASK = !1, LOG_DOC = !1, LOG_XLS = !1, LOG_SS = !1, debuglog = GLANCE_LOGGER ? function(...a) {
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
;/*
 Copyright (c) 2018 Glance Networks, Inc.
*/
var GLANCE = window.GLANCE || {};
GLANCE.MINIMIZED = !0;
var RENDER_SCALE = 1.4, PDFDoc = function() {
  function a() {
    c.url = "";
    c.actualWidth = 0;
    c.pdf = null;
    c.pageNumber = 0;
    c.page = null;
  }
  var c = {};
  a();
  c.Close = function() {
    a();
  };
  return c;
}(), PDFView, PDFViewFactory = function() {
  function a() {
    this.parentDocEl = window.parent.document.documentElement;
    this.parentBody = window.parent.document.body;
  }
  function c(b) {
    z.css("display", b);
  }
  function e() {
    var b = $("#the-canvas"), f = b.get(0).height;
    b = b.get(0).width;
    $("#annotation-layer").css({left:"0px", top:"0px", height:f + "px", width:b + "px"});
  }
  function d(b) {
    v = b;
    $("#the-page").css({transform:"scale(" + v + ")"});
    e();
  }
  function g(b) {
    switch(b) {
      case "page-fit":
        var f = Math.floor($(window).width() / PDFDoc.actualWidth * 10) / 10;
        A = !0;
        break;
      default:
        b = parseFloat(b), "number" === typeof b && (assert(0 < b), f = b, A = !1);
    }
    f && d(f);
  }
  function p() {
    if (!w && 1 !== PDFDoc.pageNumber) {
      return B(PDFDoc.pageNumber - 1);
    }
  }
  function F() {
    if (!(w || PDFDoc.pageNumber >= PDFDoc.pdf.numPages)) {
      return B(PDFDoc.pageNumber + 1);
    }
  }
  function C(b) {
    pdflog("notifyChanged", b);
    var f = window.GLANCE;
    f && f.Cobrowse && f.Cobrowse.Visitor && f.Cobrowse.Visitor.loaded && f.Cobrowse.Visitor.notifyChanged(b);
  }
  function H(b, f) {
    k.css("display", "block");
    return new Promise(function(r, t) {
      k[0].height = b.height;
      k[0].width = b.width;
      e();
      f.render({canvasContext:D, viewport:b}).then(function() {
        return f.getAnnotations();
      }, t).then(function(h) {
        var l = $("#annotation-layer").get(0);
        l.innerHTML = "";
        let q = new PDFLinkService;
        q.setDocument(PDFDoc.pdf);
        PDFJS.AnnotationLayer.render({viewport:b.clone({dontFlip:!0}), div:l, annotations:h, linkService:q, page:f});
        PDFDoc.agentselected && l.querySelectorAll(".internallink").forEach(E => {
          E.setAttribute("data-agentinteractive", "remote");
        });
        C({canvas:{gcids:[k.attr("data-gcid")]}});
        r();
      });
    });
  }
  function I(b, f) {
    m.css("display", "block");
    return new Promise(function(r, t) {
      m.css("width", b.width);
      m.css("height", b.height);
      f.getOperatorList().then(function(h) {
        return (new PDFJS.SVGGraphics(f.commonObjs, f.objs)).getSVG(h, b);
      }).then(function(h) {
        m.empty();
        m.append(h);
        C({styles:!0});
        r();
      });
    });
  }
  function B(b) {
    pdflog("showpage", b, "of", PDFDoc.pdf.numPages);
    b = parseInt(b);
    if (!jQuery.isNumeric(b) || 0 >= b || b > PDFDoc.pdf.numPages) {
      return pdflog("invalid page number"), u.val(PDFDoc.pageNumber), null;
    }
    if (PDFDoc.pageNumber !== b) {
      var f = document.activeElement;
      assert(PDFDoc.pdf);
      assert("number" === typeof b);
      assert(1 <= b && b <= PDFDoc.pdf.numPages);
      PDFDoc.pageNumber = b;
      u.prop("disabled", !0);
      w = !0;
      return new Promise(function(r, t) {
        PDFDoc.pdf.getPage(b).then(function(h) {
          pdflog("getPage got page", b);
          PDFDoc.page = h;
          var l = h.getViewport(RENDER_SCALE), q;
          "canvas" === PDFDoc.mode && (q = H(l, h));
          "svg" === PDFDoc.mode && (q = I(l, h));
          q.then(function() {
            pdflog("rendered page, viewport width:", l.width);
            window.scrollTo(0, 0);
            u.prop("disabled", !1);
            w = !1;
            PDFDoc.actualWidth = l.width;
            u.val(PDFDoc.pageNumber);
            f.focus();
            e();
            r();
          }, function(E) {
            t("Failed to render" + E);
          });
        }, function(h) {
          t("Failed to get page:" + h);
        });
      });
    }
  }
  function x(b, f) {
    b ? (n && window.clearTimeout(n), "error" === f && console.error(b), y.html(b), y.attr("class", f), y.css("display", "block"), c("block")) : y.css("display", "none");
  }
  var z = $(window.parent.document.getElementById("glance_pdfviewer")), m = $("#the-svg"), k = $("#the-canvas"), D = k[0].getContext("2d"), u = $("#pageselect"), y = jQuery("#message"), v = 1.0, A = !1, n = null, w = !1;
  a.prototype.hide = function() {
    this.overflowX = this.parentDocEl.style.overflowX;
    this.overflowY = this.parentDocEl.style.overflowY;
    this.parentDocEl.style.overflowX = "hidden";
    this.parentDocEl.style.overflowY = "hidden";
    this.overflowXbody = this.parentBody.style.overflowX;
    this.overflowYbody = this.parentBody.style.overflowY;
    this.parentBody.style.overflowX = "hidden";
    this.parentBody.style.overflowY = "hidden";
  };
  a.prototype.restore = function() {
    this.parentDocEl.style.overflowX = this.overflowX;
    this.parentDocEl.style.overflowY = this.overflowY;
    this.parentBody.style.overflowX = this.overflowXbody;
    this.parentBody.style.overflowY = this.overflowYbody;
  };
  var G = new a;
  return {downloading:function(b) {
    b && (n && window.clearTimeout(n), n = window.setTimeout(function() {
      x("Downloading " + b.split("/").pop() + "...", "info");
    }, 500));
  }, downloadcomplete:function() {
    n && window.clearTimeout(n);
    x();
  }, show:function() {
    m.css("display", "none");
    k.css("display", "none");
    G.hide();
    assert(PDFDoc.pdf);
    $("#doctitle").html(PDFDoc.url.split("/").pop());
    $("#pagetotal").html(PDFDoc.pdf.numPages);
    u.attr("max", PDFDoc.pdf.numPages);
    c("block");
    $(".firstcontrol").focus();
  }, showpage:B, close:function() {
    pdflog("closing.  viewer iframe display: ", z.css("display"));
    "block" === z.css("display") && (G.restore(), c("none"), x(), $("#doctitle").html(""), $("#pagetotal").html(""), $("style[id^=PDFJS_FONT_STYLE_TAG_]").remove(), m.empty(), D.fillStyle = "#FFFFFF", D.fillRect(0, 0, k[0].width, k[0].height), C({canvas:{gcids:[k.attr("data-gcid")]}}), PDFDoc.Close());
  }, setscale:d, zoomin:function() {
    d(Math.min(3.0, v + 0.2));
  }, zoomout:function() {
    d(Math.max(0.5, v - 0.2));
  }, zoom:g, forward:F, keydown:function(b) {
    switch(b.which) {
      case 33:
        p();
        b.preventDefault();
        break;
      case 34:
        F(), b.preventDefault();
    }
  }, windowresized:function() {
    A && g("page-fit");
  }, back:p, message:x};
}, GPDF = {View:function(a) {
  var c = a && a.url, e = a && a.data;
  if (!c && !e) {
    return Promise.resolve();
  }
  pdflog("Viewing", c ? c : "binary string PDF", a.mode);
  PDFView.downloading(c);
  (e && !c || a.options && a.options.hideDownload) && $("#pdflink").hide();
  return PDFJS.getDocument(c ? c : {data:e}).then(function(d) {
    pdflog("getDocument complete:", c);
    PDFView.downloadcomplete();
    PDFDoc.pdf = d;
    PDFDoc.agentselected = a.agentselected || !1;
    PDFDoc.preview = a.preview || !1;
    document.body.setAttribute("data-preview", PDFDoc.preview);
    PDFDoc.url = c ? c : "//";
    PDFDoc.mode = a.mode || "canvas";
    PDFView.show();
    return PDFView.showpage(1);
  }, function(d) {
    PDFView.message("Could not open document: " + d.message, "error");
    throw d;
  }).then(function() {
    pdflog("showpage completed");
    return "Viewing document";
  });
}, Close:function() {
  PDFView.close();
}}, resolveready;
GPDF.waitready = new Promise(function(a, c) {
  resolveready = a;
});
$(window).ready(function() {
  PDFView = PDFViewFactory();
  $("#closedoc").click(function(a) {
    window.parent.postMessage("docviewerclosed");
    GPDF.Close();
  });
  $("#pageselect").change(function() {
    PDFView.showpage(this.value);
  });
  $("#pageselect").keypress(function(a) {
    13 === a.which && PDFView.showpage(this.value);
  });
  $("#zoomin").click(PDFView.zoomin);
  $("#zoomout").click(PDFView.zoomout);
  $("#zoomselect").change(function() {
    PDFView.zoom(this.value);
  });
  $("#floating-button-previous").click(PDFView.back);
  $("#floating-button-next").click(PDFView.forward);
  $("[role=button]").keypress(function(a) {
    13 === a.which && this.click();
  });
  $("#pdflink").click(function() {
    window.open(PDFDoc.url, "_blank");
  });
  $(window).resize(PDFView.windowresized);
  $(document).keydown(PDFView.keydown);
  resolveready();
  GPDF.View();
});
var PDFLinkService = PDFLinkService || class {
  constructor() {
    this.pdfDocument = this.baseUrl = null;
  }
  setDocument(a, c = null) {
    this.baseUrl = c;
    this.pdfDocument = a;
    this._pagesRefCache = Object.create(null);
  }
  get pagesCount() {
    return this.pdfDocument ? this.pdfDocument.numPages : 0;
  }
  _goToDestinationHelper(a, c = null, e) {
    const d = e[0];
    let g;
    if ("object" === typeof d && null !== d) {
      if (g = this._cachedPageNumber(d), null === g) {
        this.pdfDocument.getPageIndex(d).then(p => {
          this.cachePageRef(p + 1, d);
          this._goToDestinationHelper(a, c, e);
        }).catch(() => {
          console.error(`PDFLinkService._goToDestinationHelper: "${d}" is not ` + `a valid page reference, for dest="${a}".`);
        });
        return;
      }
    } else {
      if (Number.isInteger(d)) {
        g = d + 1;
      } else {
        console.error(`PDFLinkService._goToDestinationHelper: "${d}" is not ` + `a valid destination reference, for dest="${a}".`);
        return;
      }
    }
    (!g || 1 > g || g > this.pagesCount) && console.error(`PDFLinkService._goToDestinationHelper: "${g}" is not ` + `a valid page number, for dest="${a}".`);
  }
  async goToDestination(a) {
    if (this.pdfDocument) {
      if ("string" === typeof a) {
        var c = a;
        var e = await this.pdfDocument.getDestination(a);
      } else {
        c = null, e = await a;
      }
      Array.isArray(e) ? this._goToDestinationHelper(a, c, e) : console.error(`PDFLinkService.goToDestination: "${e}" is not ` + `a valid destination array, for dest="${a}".`);
    }
  }
  navigateTo(a) {
    var c = this, e = function(d) {
      var g = d instanceof Object ? c._pagesRefCache[d.num + " " + d.gen + " R"] : d + 1;
      g ? (g > c.pagesCount && (g = c.pagesCount), PDFView.showpage(g)) : c.pdfDocument.getPageIndex(d).then(function(p) {
        c._pagesRefCache[d.num + " " + d.gen + " R"] = p + 1;
        e(d);
      });
    };
    ("string" === typeof a ? this.pdfDocument.getDestination(a) : Promise.resolve(a)).then(function(d) {
      a = d;
      d instanceof Array && e(d[0]);
    });
  }
  getDestinationHash(a) {
    if ("string" === typeof a) {
      if (0 < a.length) {
        return this.getAnchorUrl("#" + escape(a));
      }
    } else {
      if (Array.isArray(a) && (a = JSON.stringify(a), 0 < a.length)) {
        return this.getAnchorUrl("#" + escape(a));
      }
    }
    return this.getAnchorUrl("");
  }
  getAnchorUrl(a) {
    return (this.baseUrl || "") + a;
  }
  cachePageRef(a, c) {
    c && (this._pagesRefCache[0 === c.gen ? `${c.num}R` : `${c.num}R${c.gen}`] = a);
  }
  _cachedPageNumber(a) {
    a = 0 === a.gen ? `${a.num}R` : `${a.num}R${a.gen}`;
    let c;
    return (null == (c = this._pagesRefCache) ? void 0 : c[a]) || null;
  }
};

