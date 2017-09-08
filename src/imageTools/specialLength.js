import * as cornerstone from '../cornerstone-core.js';
import * as cornerstoneMath from '../cornerstone-math.js';
import touchTool from './touchTool.js';
import drawTextBox from '../util/drawTextBox.js';
import toolStyle from '../stateManagement/toolStyle.js';
import toolColors from '../stateManagement/toolColors.js';
import toolCoordinates from '../stateManagement/toolCoordinates.js';
import getHandleNearImagePoint from '../manipulators/getHandleNearImagePoint.js';
import handleActivator from '../manipulators/handleActivator.js';
import moveHandle from '../manipulators/moveHandle.js';
import moveNewHandle from '../manipulators/moveNewHandle.js';
import moveAllHandles from '../manipulators/moveAllHandles.js';
import anyHandlesOutsideImage from '../manipulators/anyHandlesOutsideImage.js';
import isMouseButtonEnabled from '../util/isMouseButtonEnabled.js';
import { addToolState, removeToolState, getToolState } from '../stateManagement/toolState.js';

const toolType = 'specialLength';

let configuration = { drawGuideLines: true };

// /////// BEGIN ACTIVE TOOL ///////
function createNewMeasurement (mouseEventData) {
    // Create the measurement data for this tool with the end handle activated
  const measurementData = {
    visible: true,
    active: true,
    handles: {
      start: {
        x: mouseEventData.currentPoints.image.x,
        y: mouseEventData.currentPoints.image.y,
        highlight: true,
        active: false
      },
      end: {
        x: mouseEventData.currentPoints.image.x,
        y: mouseEventData.currentPoints.image.y,
        highlight: true,
        active: true
      },
      textBox: {
        active: false,
        hasMoved: false,
        movesIndependently: false,
        drawnIndependently: true,
        allowedOutsideImage: true,
        hasBoundingBox: true
      }
    },
    pressedEndHandle: false,
    distAB: 0
  };

  return measurementData;
}
// /////// END ACTIVE TOOL ///////

function pointNearTool (element, data, coords) {
  const lineSegment = {
    start: cornerstone.pixelToCanvas(element, data.handles.start),
    end: cornerstone.pixelToCanvas(element, data.handles.end)
  };
  const distanceToPoint = cornerstoneMath.lineSegment.distanceToPoint(lineSegment, coords);

      // Get the last position of the end to check the radius
  if (cornerstoneMath.point.distance(lineSegment.end, coords) < 6) {
    data.pressedEndHandle = true;
    data.distAB = cornerstoneMath.point.distance(data.handles.start, data.handles.end);
  } else {
    data.pressedEndHandle = false;
  }

  return distanceToPoint < 3;
}

// /////// BEGIN IMAGE RENDERING ///////
function onImageRendered (e, eventData) {
    // If we have no toolData for this element, return immediately as there is nothing to do
  const toolData = getToolState(e.currentTarget, toolType);

  if (!toolData) {
    return;
  }

    // We have tool data for this element - iterate over each one and draw it
  const context = eventData.canvasContext.canvas.getContext('2d');

  context.setTransform(1, 0, 0, 1, 0, 0);

  const lineWidth = toolStyle.getToolWidth();
  const config = specialLength.getConfiguration();

  for (let i = 0; i < toolData.data.length; i++) {
    context.save();

        // Configurable shadow
    if (config && config.shadow) {
      context.shadowColor = config.shadowColor || '#000000';
      context.shadowOffsetX = config.shadowOffsetX || 1;
      context.shadowOffsetY = config.shadowOffsetY || 1;
    }

    const data = toolData.data[i];
    const color = toolColors.getColorIfActive(data.active);


        // Get the handle positions in canvas coordinates
    const handleStartCanvas = cornerstone.pixelToCanvas(eventData.element, data.handles.start);
    const handleEndCanvas = cornerstone.pixelToCanvas(eventData.element, data.handles.end);

        // Draw the measurement line
    context.beginPath();
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.moveTo(handleStartCanvas.x, handleStartCanvas.y);
    context.lineTo(handleEndCanvas.x, handleEndCanvas.y);
    context.stroke();

    if(config.drawGuideLines === true || data.active) {
          // Calculate perpendicular vector
      const diffx = (handleEndCanvas.x - handleStartCanvas.x);
      const diffy = (handleStartCanvas.y - handleEndCanvas.y);

          // Calculate the length
      const ss = Math.sqrt(diffx * diffx + diffy * diffy);

      const xv = diffx / ss;
      const yv = diffy / ss;

      let linesize = 6;

      if(config.drawGuideLines === true) {
            // Draw line at the middle
        let initx = (handleStartCanvas.x + handleEndCanvas.x) / 2;
        let inity = (handleStartCanvas.y + handleEndCanvas.y) / 2;

        context.beginPath();
        context.moveTo(initx + yv * linesize,
                        inity + xv * linesize);
        context.lineTo(initx + yv * -linesize,
                        inity + xv * -linesize);
        context.stroke();

            // Draw line at 1/3 and one at 2/3
        linesize = 3;
        initx = (2 * handleStartCanvas.x + handleEndCanvas.x) / 3;
        inity = (2 * handleStartCanvas.y + handleEndCanvas.y) / 3;
        context.beginPath();
        context.moveTo(initx + yv * linesize,
                        inity + xv * linesize);
        context.lineTo(initx + yv * -linesize,
                        inity + xv * -linesize);
        context.stroke();

        linesize = 3;
        initx = (handleStartCanvas.x + 2 * handleEndCanvas.x) / 3;
        inity = (handleStartCanvas.y + 2 * handleEndCanvas.y) / 3;
        context.beginPath();
        context.moveTo(initx + yv * linesize,
                        inity + xv * linesize);
        context.lineTo(initx + yv * -linesize,
                        inity + xv * -linesize);
        context.stroke();
      }

      if(data.active) {
        linesize = 2;
            // Draw line at the end
        context.beginPath();
        context.arc(handleStartCanvas.x, handleStartCanvas.y, linesize, 0, 2 * Math.PI);
        context.stroke();
      }
    }

        // Set rowPixelSpacing and columnPixelSpacing to 1 if they are undefined (or zero)
    const dx = (data.handles.end.x - data.handles.start.x) * (eventData.image.columnPixelSpacing || 1);
    const dy = (data.handles.end.y - data.handles.start.y) * (eventData.image.rowPixelSpacing || 1);

        // Calculate the length, and create the text variable with the millimeters or pixels suffix
    const length = Math.sqrt(dx * dx + dy * dy);

        // Draw the text
    context.fillStyle = color;

        // Store the length inside the tool for outside access
    data.length = length;

        // Set the length text suffix depending on whether or not pixelSpacing is available
    let suffix = ' mm';

    if (!eventData.image.rowPixelSpacing || !eventData.image.columnPixelSpacing) {
      suffix = ' pixels';
    }

        // Store the length measurement text
    const text = `${length.toFixed(2)}${suffix}`;

    if (!data.handles.textBox.hasMoved) {
      const coords = {
        x: Math.max(data.handles.start.x, data.handles.end.x)
      };

            // Depending on which handle has the largest x-value,
            // Set the y-value for the text box
      if (coords.x === data.handles.start.x) {
        coords.y = data.handles.start.y;
      } else {
        coords.y = data.handles.end.y;
      }

      data.handles.textBox.x = coords.x;
      data.handles.textBox.y = coords.y;
    }

    const textCoords = cornerstone.pixelToCanvas(eventData.element, data.handles.textBox);

        // Move the textbox slightly to the right and upwards
        // So that it sits beside the length tool handle
    textCoords.x += 10;

    const options = {
      centering: {
        x: false,
        y: true
      }
    };

        // Draw the textbox
    const boundingBox = drawTextBox(context, text, textCoords.x, textCoords.y, color, options);

    data.handles.textBox.boundingBox = boundingBox;

    if (data.handles.textBox.hasMoved) {
            // Draw dashed link line between ellipse and text
      const link = {
        start: {},
        end: {}
      };

      const midpointCanvas = {
        x: (handleStartCanvas.x + handleEndCanvas.x) / 2,
        y: (handleStartCanvas.y + handleEndCanvas.y) / 2
      };

      const points = [handleStartCanvas, handleEndCanvas, midpointCanvas];

      link.end.x = textCoords.x;
      link.end.y = textCoords.y;

      link.start = cornerstoneMath.point.findClosestPoint(points, link.end);

      const boundingBoxPoints = [{
                // Top middle point of bounding box
        x: boundingBox.left + boundingBox.width / 2,
        y: boundingBox.top
      }, {
                // Left middle point of bounding box
        x: boundingBox.left,
        y: boundingBox.top + boundingBox.height / 2
      }, {
                // Bottom middle point of bounding box
        x: boundingBox.left + boundingBox.width / 2,
        y: boundingBox.top + boundingBox.height
      }, {
                // Right middle point of bounding box
        x: boundingBox.left + boundingBox.width,
        y: boundingBox.top + boundingBox.height / 2
      }
      ];

      link.end = cornerstoneMath.point.findClosestPoint(boundingBoxPoints, link.start);

      context.beginPath();
      context.strokeStyle = color;
      context.lineWidth = lineWidth;
      context.setLineDash([2, 3]);
      context.moveTo(link.start.x, link.start.y);
      context.lineTo(link.end.x, link.end.y);
      context.stroke();
    }

    context.restore();
  }
}
// /////// END IMAGE RENDERING ///////

    // /////// BEGIN ACTIVE TOOL ///////
function addNewMeasurement (mouseEventData) {
  const element = mouseEventData.element;

  const measurementData = createNewMeasurement(mouseEventData);

  if (!measurementData) {
    return;
  }

  const eventData = {
    mouseButtonMask: mouseEventData.which
  };

      // Associate this data with this imageId so we can render it and manipulate it
  addToolState(mouseEventData.element, toolType, measurementData);

      // Since we are dragging to another place to drop the end point, we can just activate
      // The end point and let the moveHandle move it for us.
  $(element).off('CornerstoneToolsMouseMove', mouseMoveCallback);
  $(element).off('CornerstoneToolsMouseDown', mouseDownCallback);
  $(element).off('CornerstoneToolsMouseDownActivate', mouseDownActivateCallback);

  cornerstone.updateImage(element);

  let handleMover;

  if (Object.keys(measurementData.handles).length === 1) {
    handleMover = moveHandle;
  } else {
    handleMover = moveNewHandle;
  }

  handleMover(mouseEventData, toolType, measurementData, measurementData.handles.end, function () {
    measurementData.active = false;
    measurementData.invalidated = true;
    if (anyHandlesOutsideImage(mouseEventData, measurementData.handles)) {
              // Delete the measurement
      removeToolState(element, toolType, measurementData);
    }

    $(element).on('CornerstoneToolsMouseMove', eventData, mouseMoveCallback);
    $(element).on('CornerstoneToolsMouseDown', eventData, mouseDownCallback);
    $(element).on('CornerstoneToolsMouseDownActivate', eventData, mouseDownActivateCallback);

    cornerstone.updateImage(element);
  }, false);
}

function mouseDownActivateCallback (e, eventData) {
  if (isMouseButtonEnabled(eventData.which, e.data.mouseButtonMask)) {
    addNewMeasurement(eventData);

    return false; // False = causes jquery to preventDefault() and stopPropagation() this event
  }
}

  // /////// END ACTIVE TOOL ///////

  // /////// BEGIN DEACTIVE TOOL ///////

function mouseMoveCallback (e, eventData) {
  toolCoordinates.setCoords(eventData);
      // If a mouse button is down, do nothing
  if (eventData.which !== 0) {
    return;
  }

      // If we have no tool data for this element, do nothing
  const toolData = getToolState(eventData.element, toolType);

  if (!toolData) {
    return;
  }

      // We have tool data, search through all data
      // And see if we can activate a handle
  let imageNeedsUpdate = false;

  for (let i = 0; i < toolData.data.length; i++) {
          // Get the cursor position in canvas coordinates
    const coords = eventData.currentPoints.canvas;

    const data = toolData.data[i];

    if (handleActivator(eventData.element, data.handles, coords) === true) {
      imageNeedsUpdate = true;
    }

    if ((pointNearTool(eventData.element, data, coords) && !data.active) || (!pointNearTool(eventData.element, data, coords) && data.active)) {
      data.active = !data.active;
      imageNeedsUpdate = true;
    }
  }

      // Handle activation status changed, redraw the image
  if (imageNeedsUpdate === true) {
    cornerstone.updateImage(eventData.element);
  }
}


function mouseDownCallback (e, eventData) {
  let data;
  const element = eventData.element;

  function handleDoneMove () {
    data.invalidated = true;
    if (anyHandlesOutsideImage(eventData, data.handles)) {
              // Delete the measurement
      removeToolState(element, toolType, data);
    }

    cornerstone.updateImage(element);
    $(element).on('CornerstoneToolsMouseMove', eventData, mouseMoveCallback);
  }

  if (!isMouseButtonEnabled(eventData.which, e.data.mouseButtonMask)) {
    return;
  }

  const coords = eventData.startPoints.canvas;
  const toolData = getToolState(e.currentTarget, toolType);

  if (!toolData) {
    return;
  }

  let i;

      // Now check to see if there is a handle we can move

  for (i = 0; i < toolData.data.length; i++) {
    data = toolData.data[i];
    const distance = 6;
    const handle = getHandleNearImagePoint(element, data.handles, coords, distance);

    if (handle) {
      $(element).off('CornerstoneToolsMouseMove', mouseMoveCallback);
      data.active = true;

        // Check if it is the end, and only allow it to rotate
      if(Math.abs(data.handles.end.x - handle.x) < 0.01 &&
          Math.abs(data.handles.end.y - handle.y) < 0.01) {

        const distanceFromTool = {
          x: handle.x - eventData.currentPoints.image.x,
          y: handle.y - eventData.currentPoints.image.y
        };

            // Calculate previous distance
        const prevDist = cornerstoneMath.point.distance(data.handles.start, data.handles.end);

        moveHandle(eventData, toolType, data, handle, handleDoneMove, false,
          (e, eventData) => {
                // Function to only rotate end size of the line
            if (handle.hasMoved === false) {
              handle.hasMoved = true;
            }

            handle.active = true;

            handle.x = eventData.currentPoints.image.x + distanceFromTool.x;
            handle.y = eventData.currentPoints.image.y + distanceFromTool.y;

                // Calculate new distance
            const dist = cornerstoneMath.point.distance(data.handles.start, data.handles.end);

            if (Math.abs(prevDist - dist) > 0.1) {
                  // Calculate vector
              const diffx = (data.handles.end.x - data.handles.start.x);
              const diffy = (data.handles.end.y - data.handles.start.y);
                   // Calculate the length
              const ss = Math.sqrt(diffx * diffx + diffy * diffy);
              const xv = diffx / ss;
              const yv = diffy / ss;

              data.handles.end.x = data.handles.start.x + data.distAB * xv;
              data.handles.end.y = data.handles.start.y + data.distAB * yv;
            }

            cornerstone.updateImage(element);

            const eventType = 'CornerstoneToolsMeasurementModified';
            const modifiedEventData = {
              toolType,
              element,
              measurementData: data
            };

            $(element).trigger(eventType, modifiedEventData);
          });
      }else{
            // Normal movements of the handles
        moveHandle(eventData, toolType, data, handle, handleDoneMove, false);
      }

      e.stopImmediatePropagation();

      return false;
    }
  }

      // Now check to see if there is a line we can move
      // Now check to see if we have a tool that we can move
  if (!pointNearTool) {
    return;
  }

  const options = {
    deleteIfHandleOutsideImage: true,
    preventHandleOutsideImage: false
  };

  for (i = 0; i < toolData.data.length; i++) {
    data = toolData.data[i];
    data.active = false;
    if (pointNearTool(element, data, coords)) {
      data.active = true;
      $(element).off('CornerstoneToolsMouseMove', mouseMoveCallback);
      moveAllHandles(e, data, toolData, toolType, options, handleDoneMove);
      e.stopImmediatePropagation();

      return false;
    }
  }
}

function mouseUpCallback (e, eventData) {
  $(eventData.element).off('CornerstoneToolsMouseUp', mouseUpCallback);

    // Check if drawing is finished
  const toolData = getToolState(eventData.element, toolType);

  if (toolData === undefined) {
    return;
  }

  cornerstone.updateImage(eventData.element);
}
  // /////// END DEACTIVE TOOL ///////

  // Not visible, not interactive
function disable (element) {
  $(element).off('CornerstoneImageRendered', onImageRendered);
  $(element).off('CornerstoneToolsMouseMove', mouseMoveCallback);
  $(element).off('CornerstoneToolsMouseDown', mouseDownCallback);
  $(element).off('CornerstoneToolsMouseDownActivate', mouseDownActivateCallback);
  $(element).off('CornerstoneToolsMouseUp', mouseUpCallback);

  cornerstone.updateImage(element);
}

  // Visible but not interactive
function enable (element) {
  $(element).off('CornerstoneImageRendered', onImageRendered);
  $(element).off('CornerstoneToolsMouseMove', mouseMoveCallback);
  $(element).off('CornerstoneToolsMouseDown', mouseDownCallback);
  $(element).off('CornerstoneToolsMouseDownActivate', mouseDownActivateCallback);
  $(element).off('CornerstoneToolsMouseUp', mouseUpCallback);

  $(element).on('CornerstoneImageRendered', onImageRendered);

  cornerstone.updateImage(element);
}

  // Visible, interactive and can create
function activate (element, mouseButtonMask) {
  const eventData = {
    mouseButtonMask
  };

  $(element).off('CornerstoneImageRendered', onImageRendered);
  $(element).off('CornerstoneToolsMouseMove', mouseMoveCallback);
  $(element).off('CornerstoneToolsMouseDown', mouseDownCallback);
  $(element).off('CornerstoneToolsMouseDownActivate', mouseDownActivateCallback);
  $(element).off('CornerstoneToolsMouseUp', mouseUpCallback);

  $(element).on('CornerstoneImageRendered', onImageRendered);
  $(element).on('CornerstoneToolsMouseMove', eventData, mouseMoveCallback);
  $(element).on('CornerstoneToolsMouseDown', eventData, mouseDownCallback);
  $(element).on('CornerstoneToolsMouseDownActivate', eventData, mouseDownActivateCallback);

  cornerstone.updateImage(element);
}

  // Visible, interactive
function deactivate (element, mouseButtonMask) {
  const eventData = {
    mouseButtonMask
  };

  const eventType = 'CornerstoneToolsToolDeactivated';
  const statusChangeEventData = {
    mouseButtonMask,
    toolType,
    type: eventType
  };

  const event = $.Event(eventType, statusChangeEventData);

  $(element).trigger(event, statusChangeEventData);

  $(element).off('CornerstoneImageRendered', onImageRendered);
  $(element).off('CornerstoneToolsMouseMove', mouseMoveCallback);
  $(element).off('CornerstoneToolsMouseDown', mouseDownCallback);
  $(element).off('CornerstoneToolsMouseDownActivate', mouseDownActivateCallback);
  $(element).off('CornerstoneToolsMouseUp', mouseUpCallback);

  $(element).on('CornerstoneImageRendered', onImageRendered);
  $(element).on('CornerstoneToolsMouseMove', eventData, mouseMoveCallback);
  $(element).on('CornerstoneToolsMouseDown', eventData, mouseDownCallback);

  cornerstone.updateImage(element);
}

function getConfiguration () {
  return configuration;
}

function setConfiguration (config) {
  configuration = config;
}

function toogleDrawGuideLines () {
  configuration.drawGuideLines = !configuration.drawGuideLines;
}

// Module exports
const specialLength = {
  enable,
  disable,
  activate,
  deactivate,
  getConfiguration,
  setConfiguration,
  mouseDownCallback,
  mouseMoveCallback,
  mouseUpCallback,
  pointNearTool,
  toogleDrawGuideLines,
  mouseDownActivateCallback
};


const specialLengthTouch = touchTool({
  createNewMeasurement,
  onImageRendered,
  pointNearTool,
  toolType
});

export {
  specialLength,
  specialLengthTouch
};


