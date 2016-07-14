// Copyright (c) Microsoft Corporation. All rights reserved
//  device-helper.ts
//  This file contains the helper functions or objects for device handling
/// <reference path="../../Scripts/typings/angularjs/angular.d.ts" />
/// <reference path="../defs/common-types.d.ts" />

namespace SketchSvg {

    export interface ISelectCallback {
        shouldActivate(): boolean;
        onSelectStart(rect: IRect, autoActivated: boolean);
        onSelecting(rect: IRect, autoActivated: boolean);
        onSelectEnd(rect: IRect, autoActivated: boolean);
    }

    // Abstracted behavior base class
    export abstract class BehaviorBase {
        constructor(private _element: angular.IAugmentedJQuery) {
        }
         
        public abstract onDeviceDownEvent(e: IPoint); 
        public abstract onDeviceUpEvent(e: IPoint);
        public abstract onDeviceMoveEvent(e: IPoint);
        protected abstract shouldAutoActivateImpl(pointerType: string, button: number): boolean;
        protected abstract shouldIgnoreDeviceImpl(pointerType: string, button: number): boolean;

        public get element(): angular.IAugmentedJQuery {
            return this._element;
        }

        public shouldAutoActivate(e: JQueryMouseEventObject | PointerEvent)
            : boolean {
            return this.shouldAutoActivateImpl(this._getPointerType(e), e.button);
        }

        public shouldIgnoreDevice(e: JQueryMouseEventObject | PointerEvent)
            : boolean {
            return this.shouldIgnoreDeviceImpl(this._getPointerType(e), e.button);
        }

        public dispose() {
            // No-op
        }

        public static createSelectionTracker(element: angular.IAugmentedJQuery, selectCallback: ISelectCallback)
            : EventTracker {
            var selectionEventHandler = new SelectionBehavior(element, selectCallback);
            if (Capalities.hasPointerEventSupport()) {
                // Create an msPointer event handler if we are running inside IE or Edge. 
                // Which has a better handling for multi-touch, stylus, etc.
                return new MsPointerEventTracker(selectionEventHandler);
            } else {
                return new LegacyMouseEventTracker(selectionEventHandler);
            }
        }

        public static createPanningTracker(element: angular.IAugmentedJQuery, scrollCallback: Function)
            : EventTracker {
            var panningEventHandler = new PanningBehavior(element, scrollCallback);
            if (Capalities.hasPointerEventSupport()) {
                // Create an msPointer event handler if we are running inside IE or Edge. 
                // Which has a better handling for multi-touch, stylus, etc.
                return new MsPointerEventTracker(panningEventHandler);
            } else {
                return new LegacyMouseEventTracker(panningEventHandler);
            }
        }

        private _getPointerType(e: JQueryMouseEventObject | PointerEvent) {
            var pointerType = (<PointerEvent>e).pointerType;
            if (angular.isUndefined(pointerType)) {
                // This is a mouse event but not a pointer event.
                pointerType = 'mouse';
            }
            return pointerType;
        }
    }

    // Concreate panning behavior implementation
    class PanningBehavior extends BehaviorBase {
        private _lastPointPosition: IPoint;

        constructor(element: angular.IAugmentedJQuery, private _scrollCallback: Function) {
            super(element);
        }

        protected shouldIgnoreDeviceImpl(pointerType: string, button: number)
            : boolean {
            return (pointerType === 'mouse' && button !== 0)    // Ignore Mouse even when left button is not pressed
                || (pointerType === 'pen' && button !== 0);     // Ignore Pen even when barrel button is pressed
        }

        protected shouldAutoActivateImpl(pointerType: string, button: number) {
            // Never automatically activate the panning behavior
            return false;   
        }

        public onDeviceDownEvent(e: IPoint) {
            this._lastPointPosition = {
                x: e.x,
                y: e.y
            };
        }

        public onDeviceUpEvent(e: IPoint) {
        }

        public onDeviceMoveEvent(e: IPoint) {
            if (angular.isDefined(this._scrollCallback)) {
                var xDelta = e.x - this._lastPointPosition.x;
                var yDelta = e.y - this._lastPointPosition.y;
                this._lastPointPosition = {
                    x: e.x,
                    y: e.y
                };
                this._scrollCallback(xDelta, yDelta);
            }
        }
    }

    class SelectionBehavior extends BehaviorBase {
        private _downPosition: IPoint;
        private _hasDragStarted: boolean = false;
        private _isActivatedByRightClick: boolean = false;
        private _contextMenuHandler: (e: JQueryEventObject) => void;

        constructor(element: angular.IAugmentedJQuery, private _selectionCallback: ISelectCallback) {
            super(element);

            this._contextMenuHandler = (e: JQueryEventObject) => {
                // Disable the default context menu
                return false;
            };

            this.element.bind('contextmenu', this._contextMenuHandler);
        }

        public onDeviceDownEvent(e: IPoint) {
            this._downPosition = {
                x: e.x,
                y: e.y
            };
            this._selectionCallback.onSelectStart({
                x: this._downPosition.x,
                y: this._downPosition.y,
                width: 0,
                height: 0
            }, this._isActivatedByRightClick);
        }

        public onDeviceUpEvent(e: IPoint) {
            var rect: IRect;
            if (this._hasDragStarted) {
                rect = {
                    x: Math.min(e.x, this._downPosition.x),
                    y: Math.min(e.y, this._downPosition.y),
                    width: Math.abs(e.x - this._downPosition.x),
                    height: Math.abs(e.y - this._downPosition.y)
                };
            } else {
                rect = {
                    x: this._downPosition.x,
                    y: this._downPosition.y,
                    width: 0,
                    height: 0
                };
            }

            this._selectionCallback.onSelectEnd(rect, this._isActivatedByRightClick);
        }

        public onDeviceMoveEvent(e: IPoint) {
            this._hasDragStarted = true;
            this._selectionCallback.onSelecting({
                x: Math.min(e.x, this._downPosition.x),
                y: Math.min(e.y, this._downPosition.y),
                width: Math.abs(e.x - this._downPosition.x),
                height: Math.abs(e.y - this._downPosition.y)
            }, this._isActivatedByRightClick);
        }

        public dispose() {
            this.element.unbind('contextmenu', this._contextMenuHandler);
        }

        protected shouldAutoActivateImpl(pointerType: string, button: number)
            : boolean {
            if ((pointerType === 'mouse' && button === 2)   // Mouse right button
                || (pointerType === 'pen' && button === 2)    // Pen tip w/ barrel button pressed
            ) {
                this._isActivatedByRightClick = this._selectionCallback.shouldActivate();
                return this._isActivatedByRightClick;
            }

            return false;
        }

        protected shouldIgnoreDeviceImpl(pointerType: string, button: number) {
            return false;   // Never ignore events
        }
    }

    // Event tracker base
    export abstract class EventTracker {
        private _disposed = false;
        protected _isEnabled = true;

        constructor(protected _behavior: BehaviorBase) {
        }

        public enable() {
            this._isEnabled = true;
        }

        public disable() {
            this._isEnabled = false;
        }

        public dispose() {
            if (!this._disposed) {
                this._behavior.dispose();
                this.onDispose();
                this._behavior = null;
                this._disposed = true;
            }
        }

        protected shouldHandleDeviceDown(e: JQueryMouseEventObject | PointerEvent)
            : boolean {
                // Ask the behavior whether it wants to activate itself when a device down is received.
                // For example, mouse right-down should activate the selection behavior automatically.
            if (!this._behavior.shouldAutoActivate(e)) {
                // Now check whether the track is disabled or receive a device event which should
                // be ignored.
                if (!this._isEnabled || this._behavior.shouldIgnoreDevice(e)) {
                    return false;
                }
            }

            return true;
        }

        protected abstract onDispose();
    }

    // An event tracker implementation based on the legacy DOM mouse event model
    class LegacyMouseEventTracker extends EventTracker {
        private _isMouseDown: boolean = false;
        private _mouseDownHandler: (e: JQueryMouseEventObject) => void;
        private _mouseMoveHandler: (e: JQueryMouseEventObject) => void;
        private _mouseUpHandler: (e: JQueryMouseEventObject) => void;

        constructor(behavior: BehaviorBase) {
            super(behavior);

            this._mouseMoveHandler = (e: JQueryMouseEventObject) => {
                this._onMouseMove(e);
            };

            this._mouseUpHandler = (e: JQueryMouseEventObject) => {
                this._onMouseUp(e);
            };

            this._mouseDownHandler = (e: JQueryMouseEventObject) => {
                if (!this.shouldHandleDeviceDown(e)) {
                    return;
                }

                if (!this._isMouseDown) {
                    this._behavior.onDeviceDownEvent({
                        x: e.clientX,
                        y: e.clientY
                    });

                    // Caputure mouse inputs on document.
                    $(document).bind('mousemove', this._mouseMoveHandler);
                    $(document).bind('mouseup', this._mouseUpHandler);
                    this._isMouseDown = true;
                    e.preventDefault();
                }
            };

            behavior.element.bind('mousedown', this._mouseDownHandler);
        }

        protected onDispose() {
            // Clean up the handlers
            if (this._isMouseDown) {
                this._behavior.onDeviceUpEvent({
                    x: 0,
                    y: 0
                })
                this._isMouseDown = false;

                // Release mouse capture on document.
                $(document).unbind('mousemove', this._mouseMoveHandler);
                $(document).unbind('mouseup', this._mouseUpHandler);
            }
            this._behavior.element.unbind('mousedown', this._mouseDownHandler);
        }

        private _onMouseMove(e: JQueryMouseEventObject) {
            if (this._isMouseDown) {
                this._behavior.onDeviceMoveEvent({
                    x: e.clientX,
                    y: e.clientY
                });
                e.preventDefault();
            }
        }

        private _onMouseUp(e: JQueryMouseEventObject) {
            if (this._isMouseDown) {
                this._behavior.onDeviceUpEvent({
                    x: e.clientX,
                    y: e.clientY
                })
                this._isMouseDown = false;

                // Release mouse capture on document.
                $(document).unbind('mousemove', this._mouseMoveHandler);
                $(document).unbind('mouseup', this._mouseUpHandler);
                e.preventDefault();
            }
        }
    }

    // An event tracker implementation based on the MSPointer events model for IE or Edge.
    class MsPointerEventTracker extends EventTracker {
        private _capturedPointerDeviceId: number;
        private _msPointerDownHandler: (e: PointerEvent) => void;
        private _msPointerUpHandler: (e: PointerEvent) => void;
        private _msPointerMoveHandler: (e: PointerEvent) => void;

        constructor(behavior: BehaviorBase) {
            super(behavior);

            var element = this._behavior.element[0];
            this._msPointerMoveHandler = (e: PointerEvent) => {
                this._onMsPointerMove(e);
            };

            this._msPointerUpHandler = (e: PointerEvent) => {
                this._onMsPointerUp(e);
            };

            this._msPointerDownHandler = (e: PointerEvent) => {
                if (!this.shouldHandleDeviceDown(e)) {
                    return;
                }

                if (angular.isUndefined(this._capturedPointerDeviceId)) {
                    this._capturedPointerDeviceId = e.pointerId;
                    element.addEventListener('pointermove', this._msPointerMoveHandler);
                    element.addEventListener('pointerup', this._msPointerUpHandler);
                    element.setPointerCapture(this._capturedPointerDeviceId);
                    this._behavior.onDeviceDownEvent({
                        x: e.clientX,
                        y: e.clientY
                    });
                    e.preventDefault();
                }
            };

            element.addEventListener('pointerdown', this._msPointerDownHandler);
        }

        protected onDispose() {
            // Clean up the handlers
            var element = this._behavior.element[0];
            if (angular.isDefined(this._capturedPointerDeviceId)) {
                this._behavior.onDeviceUpEvent({
                    x: 0,
                    y: 0
                })

                element.removeEventListener('pointermove', this._msPointerMoveHandler);
                element.removeEventListener('pointerup', this._msPointerUpHandler);
                element.releasePointerCapture(this._capturedPointerDeviceId);
                this._capturedPointerDeviceId = undefined;

            }
            element.removeEventListener('pointerdown', this._msPointerDownHandler);
        }

        private _onMsPointerMove(e: MSPointerEvent) {
            if (this._capturedPointerDeviceId === e.pointerId) {
                this._behavior.onDeviceMoveEvent({
                    x: e.clientX,
                    y: e.clientY
                });
                e.preventDefault();
            }
        }

        private _onMsPointerUp(e: MSPointerEvent) {
            if (this._capturedPointerDeviceId === e.pointerId) {
                this._behavior.onDeviceUpEvent({
                    x: e.clientX,
                    y: e.clientY
                });

                var element = this._behavior.element[0];
                element.removeEventListener('MSPointerMove', this._msPointerMoveHandler);
                element.removeEventListener('MSPointerUp', this._msPointerUpHandler);
                element.releasePointerCapture(this._capturedPointerDeviceId);
                this._capturedPointerDeviceId = undefined;
                e.preventDefault();
            }
        }
    }
}