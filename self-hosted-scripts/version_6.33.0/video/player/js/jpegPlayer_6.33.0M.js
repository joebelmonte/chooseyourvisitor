if( !window.GLANCE ) window.GLANCE = {}


/**
 * A very simple JPEG version of the Broadway Player interface
 * @param options
 * @returns {GLANCE.JpegPlayer}
 * @constructor
 */
GLANCE.JpegPlayer = function GLANCEJpegPlayer( options ) {
  var _this = this
  _this._options = options
  _this.targetDimensions = options.size
  _this.sourceDimensions = options.size
  _this._targetScalable = _this._options.targetScalable

  _this._renderImage = document.createElement( 'img' )
  _this._renderImage.width = _this.sourceDimensions.width
  _this._renderImage.height = _this.sourceDimensions.height

  /* create these when we know dimensions */
  _this._canvas = document.createElement( 'canvas' )
  _this._canvas.classList.add( 'videorender' )
  _this._canvas.width = _this.targetDimensions.width
  _this._canvas.height = _this.targetDimensions.height
  _this._canvas.style.backgroundColor = _this._options.backgroundColor || '#0D0E1B'
  _this._context = _this._canvas.getContext( '2d' )
  _this._context.globalCompositeOperation = 'copy'
  _this._context.globalAlpha = 1.0

  /**
   * MIME type being handled
   * @type {string}
   */
  _this.mime = (options && typeof options.mime === 'string') ? options.mime : 'image/jpeg'
  /**
   * the element used for rendering
   * @type {HTMLCanvasElement}
   */
  _this.domNode = _this._canvas

  /**
   * handler for frame (video source) dimensions change
   * @type {function}
   */
  _this.onFrameSizeChange = null
  /**
   * handler for completed frame rendering
   * @type {function}
   */
  _this.renderFrameComplete = null

  /* don't start new image decoding while one is already in progress */
  _this._imageLoadPending = false

  GLANCEJpegPlayer.prototype._onerror = function( ev ) {
    console.error( 'image render error', ev )
  }
  GLANCEJpegPlayer.prototype._onload = function( ev ) {
    var img = ev.target
    var _this = img.jpegPlayer
    window.URL.revokeObjectURL( img.src )
    _this._imageLoadPending = false

    /* change of size on incoming data stream ? */
    var dimensions = { width: img.naturalWidth, height: img.naturalHeight }
    if( dimensions.width !== _this.sourceDimensions.width
      || dimensions.height !== _this.sourceDimensions.height ) {
      /* new frame (source) dimensions */
      if( _this.onFrameSizeChange && typeof _this.onFrameSizeChange === 'function' ) {
        /* deliver notification */
        _this.onFrameSizeChange( {
          sourceWidth: dimensions.width,
          sourceHeight: dimensions.height,
          targetWidth: _this.targetDimensions.width,
          targetHeight: _this.targetDimensions.height
        } )
      }
      _this.sourceDimensions = dimensions
    }
    var targetWidth = _this.targetDimensions.width
    var targetHeight = _this.targetDimensions.height
    var sourceWidth = _this.sourceDimensions.width
    var sourceHeight = _this.sourceDimensions.height
    if( _this._targetScalable ) {
      /* when scaling decoded image to target area, adjust dimensions
       * to preserve decoded aspect ratio */
      var targetAspectRatio = targetWidth / targetHeight
      var decodedAspectRatio = sourceWidth / sourceHeight
      if( targetAspectRatio > decodedAspectRatio )
        targetWidth = Math.trunc( targetHeight * decodedAspectRatio )
      else
        targetHeight = Math.trunc( targetWidth / decodedAspectRatio )
    }

    if( _this._canvas.width !== targetWidth || _this._canvas.height !== targetHeight ) {
      _this._canvas.width = targetWidth
      _this._canvas.height = targetHeight
    }

    var renderIdentity = sourceWidth === targetWidth && sourceHeight === targetHeight
    if( renderIdentity ) {
      _this._context.drawImage( img, 0, 0 )
    }
    else {
      _this._context.drawImage( img, 0, 0, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight )
    }
    if( _this.renderFrameComplete && typeof _this.renderFrameComplete === 'function' ) {
      _this.renderFrameComplete( {} )
    }
  }

  // noinspection JSUnusedLocalSymbols
  /**
   * decode and render
   * @param {Uint8Array} payload containing one jpeg / jfif image
   * @param {object} infos options
   */
  GLANCEJpegPlayer.prototype.decode = function( payload, infos ) {
    var _this = this
    var img = _this._renderImage
    if( !img.jpegPlayer ) {
      img.jpegPlayer = _this
      img.onload = _this._onload
      img.onerror = _this._onerror
    }
    if( !_this._imageLoadPending ) {
      this._imageLoadPending = true
      var blob = new Blob( [payload], { type: _this.mime } )
      _this._renderImage.src = window.URL.createObjectURL( blob )
    }
  }

  /**
   * get source dimensions
   * @returns {null|*}
   */
  GLANCEJpegPlayer.prototype.getSourceDimensions = function() {
    var _this = this
    return _this.sourceDimensions
  }
  /**
   * set source dimensions (w/h of video source)
   * @param {object }rect {width: w, height: h}
   */
  GLANCEJpegPlayer.prototype.setSourceDimensions = function( rect ) {
    var _this = this
    _this.sourceDimensions = rect
  }

  GLANCEJpegPlayer.prototype.getTargetDimensions = function() {
    var _this = this
    return _this.targetDimensions
  }
  /**
   * set target drawing dimensions
   * @param {object }rect {width: w, height: h}
   */
  GLANCEJpegPlayer.prototype.setTargetDimensions = function( rect ) {
    var _this = this
    _this.targetDimensions = rect
  }
  /**
   * release player resources if any
   * @private
   */
  GLANCEJpegPlayer.prototype._deletePlayer = function() {
    var _this = this
    _this.domNode = null
    _this.canvas = null
    _this.canvasObj = null
  }
  return _this
} /* end ctor */

/* polyfill for IE 11 */
if( !Math.trunc ) {
  Math.trunc = function( v ) {
    v = +v
    if( !isFinite( v ) ) return v
    return (v - v % 1) || (v < 0 ? -0 : v === 0 ? v : 0)
  }
}


