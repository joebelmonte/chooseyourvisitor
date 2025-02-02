/**
 * @preserve Copyright (c) 2020-2024 Glance Networks, Inc.
 * 
 * Generate the HTML used by the video player (VideoPlayer.js)
 * This can be used by AgentViewer.js or by /videoplayer/VideoPlayer.aspx
 */

window["GLANCE"] = window["GLANCE"] || {};
// I'd rather this was on GLANCE.Video but that is not used as a namespace but assigned in 
window["GLANCE"] ["VideoPlayerUtils"] = window["GLANCE"] ["VideoPlayerUtils"] || {};

/**
* Parameters passed to VideoPlayer.js
* @typedef {{
*   offer:      string,
*   guestid:    number,
*   gpu:        number,
*   chaostime:  number,
*   noendpage:  number
*   }}
*   @property {string} offer     - offer url https://vserverHostName/offer/offerNonce  required
*   @property {number} guestid   - nnnnn identity of guest (a number)
*   @property {number} gpu       -  0 means suppress use of WebGL for rendering. Omit or 1 means choose according to browser capabilities
*   @property {number} chaostime - if provided, player reloads in a random time between 0 and n seconds.
*   @property {number} noendpage - if provided, player does not move to end page when the session ends.
*/
var VideoPlayerParams;

if (true) {
let _VU = window["GLANCE"] ["VideoPlayerUtils"];

/**
 * GLANCE.VideoPlayerUtils.PlayerHtml
 * @export
 * @param {VideoPlayerParams} params Player params
 * @param {string} scriptserver hostname of the cdn script server e.g. cdn.glance.net
 * @param {string} scriptversion version of video scripts to use, including min indicator, e.g. 6.20.1M
 * @param {string=} cssversion version of video css file use, defaults to scriptversion without min indicator
 * @returns {string} html of page/iframe hosting player
*/
_VU.PlayerHtml = function (params, scriptserver, scriptversion, cssversion) 
{
    cssversion = cssversion || scriptversion.replace("M", "");

    // VideoPlayer.js is expecting to find the offer (url) and other parameters on the query string
    // @@@efh TODO: setting location.search in script below works but is another pretty gross hack
    // it would be better to also allow reading params from a meta tag, 
    // or maybe better just don't redirect to ViewerEnd and expose Start() for us to call

    var urlparams = "";
    for (let prop in params)
        urlparams = `${urlparams}${prop}=${params[prop]}&`;

    // @@@efh we ought to concatenate all those video scripts to one
    return `<!DOCTYPE html>
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
            <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
            <meta name="viewport" content="width=device-width, minimum-scale=1.0, initial-scale=1.0, user-scalable=yes"/>
            <meta name="mobile-web-app-capable" content="yes"/>
            <base target="_blank"/>
            <script>
            location.search = "?${urlparams}"; 
            </script>
        </head>
        <body>
            <link rel="stylesheet" href="https://${scriptserver}/video/player/css/font-awesome.min.css" crossorigin="anonymous"/>
            <link rel="stylesheet" href="https://${scriptserver}/video/player/css/video-player_${cssversion}.css" crossorigin="anonymous"/>
        <!-- Note well: other Glance software (mobile etc) relies on the selector
                    div#container div.videocontainer > canvas
            to find the canvas (or possibly canvases) created and used by
            this Glance Video Player. So make sure that selector still finds
            video canvases if you change this code.
        -->
        <div id="container">
        <div class="videocontainer"></div>
        <!--  VideoPlayer.js adds the "visible" class to this "loading" div when it should be shown,
                and removes that class when it should be hidden. -->
        <div id="loading" class="modal">
        <!--    <div><i class="fa fa-circle-o-notch fa-spin fa-1x fa-fw"></i><span class="msg">Loading</span></div>-->
            <div class="glance_spinner">
                <div class="glance_bounce1"></div>
                <div class="glance_bounce2"></div>
                <div class="glance_bounce3"></div>
            </div>
        </div>
        <!--  VideoPlayer.js adds the "visible" class to this "stopped" div when it should be shown,
                and removes that class when it should be hidden. -->
        <div id="stopped" class="modal">
            <div><i class="fa fa-cog fa-spin fa-1x fa-fw"></i><span class="msg">Waiting</span></div>
        </div>
        </div>
        <script src="https://${scriptserver}/video/player/js/setDomain_${scriptversion}.js"></script>
        <!-- What can this browser do? -->
        <script src="https://${scriptserver}/video/source/js/browserCap_${scriptversion}.js"></script>
        <!-- Glance video player -->
        <script src="https://${scriptserver}/video/player/js/GlanceVisitorVideo_${scriptversion}.js"></script>
        <!-- Video stuff: the order here is important. -->
        <!-- MSE player -->
        <script src="https://${scriptserver}/video/player/js/fmp4muxer_${scriptversion}.js"></script>
        <script src="https://${scriptserver}/video/player/js/msePlayer_${scriptversion}.js"></script>
        <!-- JPEG player -->
        <script src="https://${scriptserver}/video/player/js/jpegPlayer_${scriptversion}.js"></script>
        <!-- Broadway player -->
        <script src="https://${scriptserver}/video/player/js/YUVCanvas_${scriptversion}.js"></script>
        <script src="https://${scriptserver}/video/player/js/Decoder_${scriptversion}.js"></script>
        <script src="https://${scriptserver}/video/player/js/Player_${scriptversion}.js"></script>
        <!-- deboxers -->
        <script src="https://${scriptserver}/video/player/js/fmp4_${scriptversion}.js"></script>
        <script src="https://${scriptserver}/video/player/js/ebml_${scriptversion}.js"></script>
        <script src="https://${scriptserver}/video/player/js/jpeg_${scriptversion}.js"></script>
        <!-- This page's script -->
        <script src="https://${scriptserver}/video/player/js/VideoPlayer_${scriptversion}.js"></script>
        </body>
        </html>`;
}

};


