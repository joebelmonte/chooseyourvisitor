/*

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/
'use strict';function b(a){for(var f=document.createElement(a.tagName),c=0;c<a.attributes.length;c++)f.setAttribute(a.attributes[c].name,a.attributes[c].value);a:if(c=Object.getPrototypeOf(document.createElement("div"))){for(var g;!(g=Object.getOwnPropertyDescriptor(c,"innerHTML"))||0>g.get.toString().indexOf("[native code]");)if(c=Object.getPrototypeOf(c),!c){a=a.innerHTML;break a}a=g.get.call(a)}else a=a.innerHTML;f.innerHTML=a;return f}var d=["clone"],e=this||self;
d[0]in e||"undefined"==typeof e.execScript||e.execScript("var "+d[0]);for(var h;d.length&&(h=d.shift());)d.length||void 0===b?e[h]&&e[h]!==Object.prototype[h]?e=e[h]:e=e[h]={}:e[h]=b;
