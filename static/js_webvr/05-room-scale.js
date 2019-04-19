/* global mat4, vec3, VRCubeIsland, WGLUDebugGeometry, WGLUStats, WGLUTextureLoader, VRSamplesUtil */
(function () {
"use strict";

var PLAYER_HEIGHT = 1.65;

var vrDisplay = null;
var frameData = null;
var projectionMat = mat4.create();
var viewMat = mat4.create();
var vrPresentButton = null;

// ===================================================
// WebGL scene setup. This code is not WebVR specific.
// ===================================================

// WebGL setup.
var gl = null;
var cubeIsland = null;
var stats = null;
var debugGeom = null;

function onContextLost( event ) {
	event.preventDefault();
	console.log( 'WebGL Context Lost.' );
	gl = null;
	cubeIsland = null;
	debugGeom = null;
	stats = null;
}

function onContextRestored( event ) {
	console.log( 'WebGL Context Restored.' );
	initWebGL(vrDisplay ? vrDisplay.capabilities.hasExternalDisplay : false);
}

var webglCanvas = document.getElementById("webgl-canvas");
webglCanvas.addEventListener( 'webglcontextlost', onContextLost, false );
webglCanvas.addEventListener( 'webglcontextrestored', onContextRestored, false );

function initWebGL (preserveDrawingBuffer) {
	var glAttribs = {
		alpha: false,
		preserveDrawingBuffer: preserveDrawingBuffer
	};
	var useWebgl2 = WGLUUrl.getBool('webgl2', false);
	var contextTypes = useWebgl2 ? ["webgl2"] : ["webgl", "experimental-webgl"];
	for (var i in contextTypes) {
		gl = webglCanvas.getContext(contextTypes[i], glAttribs);
		if (gl)
			break;
	}
	if (!gl) {
		var webglType = (useWebgl2 ? "WebGL 2" : "WebGL")
		VRSamplesUtil.addError("Your browser does not support " + webglType + ".");
		return;
	}
	gl.clearColor(0.1, 0.2, 0.3, 1.0);
	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);

	var textureLoader = new WGLUTextureLoader(gl);
	var texture = textureLoader.loadTexture("media/textures/cube-sea.png");

	// If the VRDisplay doesn't have stageParameters we won't know
	// how big the users play space. Construct a scene around a
	// default space size like 2 meters by 2 meters as a placeholder.
	cubeIsland = new VRCubeIsland(gl, texture, 2, 2);

	var enablePerformanceMonitoring = WGLUUrl.getBool(
			'enablePerformanceMonitoring', false);
	stats = new WGLUStats(gl, enablePerformanceMonitoring);
	debugGeom = new WGLUDebugGeometry(gl);

	// Wait until we have a WebGL context to resize and start rendering.
	window.addEventListener("resize", onResize, false);
	onResize();
	window.requestAnimationFrame(onAnimationFrame);
}

// ================================
// WebVR-specific code begins here.
// ================================

function onVRRequestPresent () {
	vrDisplay.requestPresent([{ source: webglCanvas }]).then(function () {
	}, function (err) {
		var errMsg = "requestPresent failed.";
		if (err && err.message) {
			errMsg += "<br/>" + err.message
		}
		VRSamplesUtil.addError(errMsg, 2000);
	});
}

function onVRExitPresent () {
	if (!vrDisplay.isPresenting)
		return;

	vrDisplay.exitPresent().then(function () {
	}, function () {
		VRSamplesUtil.addError("exitPresent failed.", 2000);
	});
}

function onVRPresentChange () {
	onResize();

	if (vrDisplay.isPresenting) {
		if (vrDisplay.capabilities.hasExternalDisplay) {
			VRSamplesUtil.removeButton(vrPresentButton);
			vrPresentButton = VRSamplesUtil.addButton("Exit VR", "E", "media/icons/cardboard64.png", onVRExitPresent);
		}
	} else {
		if (vrDisplay.capabilities.hasExternalDisplay) {
			VRSamplesUtil.removeButton(vrPresentButton);
			vrPresentButton = VRSamplesUtil.addButton("Enter VR", "E", "media/icons/cardboard64.png", onVRRequestPresent);
		}
	}
}

if (navigator.getVRDisplays) {
	frameData = new VRFrameData();

	navigator.getVRDisplays().then(function (displays) {
		if (displays.length > 0) {
			vrDisplay = displays[displays.length - 1];
			vrDisplay.depthNear = 0.1;
			vrDisplay.depthFar = 1024.0;

			initWebGL(vrDisplay.capabilities.hasExternalDisplay);

			if (vrDisplay.stageParameters &&
					vrDisplay.stageParameters.sizeX > 0 &&
					vrDisplay.stageParameters.sizeZ > 0) {
				// If we have stageParameters with a valid size use that to resize
				// our scene to match the users available space more closely. The
				// check for size > 0 is necessary because some devices, like the
				// Oculus Rift, can give you a standing space coordinate but don't
				// have a configured play area. These devices will return a stage
				// size of 0.
				cubeIsland.resize(vrDisplay.stageParameters.sizeX, vrDisplay.stageParameters.sizeZ);
			} else {
				if (vrDisplay.stageParameters) {
					VRSamplesUtil.addInfo("VRDisplay reported stageParameters, but stage size was 0. Using default size.", 3000);
				} else {
					VRSamplesUtil.addInfo("VRDisplay did not report stageParameters", 3000);
				}
			}

			if (vrDisplay.capabilities.canPresent)
				vrPresentButton = VRSamplesUtil.addButton("Enter VR", "E", "media/icons/cardboard64.png", onVRRequestPresent);

			// For the benefit of automated testing. Safe to ignore.
			if (vrDisplay.capabilities.canPresent && WGLUUrl.getBool('canvasClickPresents', false))
				webglCanvas.addEventListener("click", onVRRequestPresent, false);

			window.addEventListener('vrdisplaypresentchange', onVRPresentChange, false);
			window.addEventListener('vrdisplayactivate', onVRRequestPresent, false);
			window.addEventListener('vrdisplaydeactivate', onVRExitPresent, false);
		} else {
			initWebGL(false);
			VRSamplesUtil.addInfo("WebVR supported, but no VRDisplays found.", 3000);
		}
	}, function () {
		VRSamplesUtil.addError("Your browser does not support WebVR. See <a href='http://webvr.info'>webvr.info</a> for assistance.");
	});
} else if (navigator.getVRDevices) {
	initWebGL(false);
	VRSamplesUtil.addError("Your browser supports WebVR but not the latest version. See <a href='http://webvr.info'>webvr.info</a> for more info.");
} else {
	initWebGL(false);
	VRSamplesUtil.addError("Your browser does not support WebVR. See <a href='http://webvr.info'>webvr.info</a> for assistance.");
}

function onResize () {
	if (vrDisplay && vrDisplay.isPresenting) {
		var leftEye = vrDisplay.getEyeParameters("left");
		var rightEye = vrDisplay.getEyeParameters("right");

		webglCanvas.width = Math.max(leftEye.renderWidth, rightEye.renderWidth) * 2;
		webglCanvas.height = Math.max(leftEye.renderHeight, rightEye.renderHeight);
	} else {
		webglCanvas.width = webglCanvas.offsetWidth * window.devicePixelRatio;
		webglCanvas.height = webglCanvas.offsetHeight * window.devicePixelRatio;
	}
}

function onClick () {
	// Reset the background color to a random value
	if (gl) {
		gl.clearColor(
			Math.random() * 0.5,
			Math.random() * 0.5,
			Math.random() * 0.5, 1.0);
	}
}

// Register for mouse restricted events while in VR
// (e.g. mouse no longer available on desktop 2D view)
function onDisplayPointerRestricted() {
	if (webglCanvas && webglCanvas.requestPointerLock) {
		webglCanvas.requestPointerLock();
	}
}

// Register for mouse unrestricted events while in VR
// (e.g. mouse once again available on desktop 2D view)
function onDisplayPointerUnrestricted() {
	var lock = document.pointerLockElement;
	if (lock && lock === webglCanvas && document.exitPointerLock) {
		document.exitPointerLock();
	}
}

VRSamplesUtil.addVRClickListener(onClick);
webglCanvas.addEventListener("click", onClick, false);
window.addEventListener('vrdisplaypointerrestricted', onDisplayPointerRestricted);
window.addEventListener('vrdisplaypointerunrestricted', onDisplayPointerUnrestricted);

// Get a matrix for the pose that takes into account the stageParameters
// if we have them, and otherwise adjusts the position to ensure we're
// not stuck in the floor.
function getStandingViewMatrix (out, view) {
	if (vrDisplay.stageParameters) {
		// If the headset provides stageParameters use the
		// sittingToStandingTransform to transform the view matrix into a
		// space where the floor in the center of the users play space is the
		// origin.
		mat4.invert(out, vrDisplay.stageParameters.sittingToStandingTransform);
		mat4.multiply(out, view, out);
	} else {
		// Otherwise you'll want to translate the view to compensate for the
		// scene floor being at Y=0. Ideally this should match the user's
		// height (you may want to make it configurable). For this demo we'll
		// just assume all human beings are 1.65 meters (~5.4ft) tall.
		mat4.identity(out);
		mat4.translate(out, out, [0, PLAYER_HEIGHT, 0]);
		mat4.invert(out, out);
		mat4.multiply(out, view, out);
	}
}

function renderSceneView (projection, view, pose) {
	cubeIsland.render(projection, view, stats);

	// For fun, draw a blue cube where the players head would have been if
	// we weren't taking the stageParameters into account. It'll start in
	// the center of the floor.
	var orientation = pose.orientation;
	var position = pose.position;
	if (!orientation) { orientation = [0, 0, 0, 1]; }
	if (!position) { position = [0, 0, 0]; }
	debugGeom.bind(projection, view);
	debugGeom.drawCube(orientation, position, 0.2, [0, 0, 1, 1]);
}

function onAnimationFrame (t) {
	// do not attempt to render if there is no available WebGL context
	if (!gl || !stats || !cubeIsland || !debugGeom) {
		return;
	}
	stats.begin();

	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	if (vrDisplay) {
		vrDisplay.requestAnimationFrame(onAnimationFrame);

		vrDisplay.getFrameData(frameData);

		if (vrDisplay.isPresenting) {
			gl.viewport(0, 0, webglCanvas.width * 0.5, webglCanvas.height);
			getStandingViewMatrix(viewMat, frameData.leftViewMatrix);
			renderSceneView(frameData.leftProjectionMatrix, viewMat, frameData.pose);

			gl.viewport(webglCanvas.width * 0.5, 0, webglCanvas.width * 0.5, webglCanvas.height);
			getStandingViewMatrix(viewMat, frameData.rightViewMatrix);
			renderSceneView(frameData.rightProjectionMatrix, viewMat, frameData.pose);

			vrDisplay.submitFrame();
		} else {
			gl.viewport(0, 0, webglCanvas.width, webglCanvas.height);
			mat4.perspective(projectionMat, Math.PI*0.4, webglCanvas.width / webglCanvas.height, 0.1, 1024.0);
			getStandingViewMatrix(viewMat, frameData.leftViewMatrix);
			renderSceneView(projectionMat, viewMat, frameData.pose);
			stats.renderOrtho();
		}
	} else {
		window.requestAnimationFrame(onAnimationFrame);

		// No VRDisplay found.
		gl.viewport(0, 0, webglCanvas.width, webglCanvas.height);
		mat4.perspective(projectionMat, Math.PI*0.4, webglCanvas.width / webglCanvas.height, 0.1, 1024.0);
		mat4.identity(viewMat);
		mat4.translate(viewMat, viewMat, [0, -PLAYER_HEIGHT, 0]);
		cubeIsland.render(projectionMat, viewMat, stats);

		stats.renderOrtho();
	}

	stats.end();
}
})();
