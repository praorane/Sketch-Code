//  Copyright (c) Microsoft Corporation. All rights reserved
//  map-portal-view.directive.ts
//  Controller for the portal view. 

/// <reference path="../../Scripts/typings/angularjs/angular.d.ts" />
/// <reference path="../defs/common-types.d.ts" />
/// <reference path="../utilities/utilities.ts" />

namespace SketchSvg {
    'use strict';

    export class PortalViewController {

        constructor() {
        }

        public getInitialViewOverlay()
            : number {
            return MapOverlays.reservationDemands | MapOverlays.propertyGroups;
        }
    }
}