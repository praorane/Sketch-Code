// Copyright (c) Microsoft Corporation. All rights reserved
//  map-view.directive.ts
//  The implementation of map view.

/// <reference path="../../Scripts/typings/angularjs/angular.d.ts" />
/// <reference path="colocation-map.directive.ts" />

module SketchSvg {
    'use strict';

    interface IMapViewHostAttributes extends angular.IAttributes {
        templatePath: string;
    }

    export class MapViewHost implements angular.IDirective {
        public restrict: string = 'E';

        public scope: boolean = false;

        constructor(private $compile: angular.ICompileService, private $templateCache: angular.ITemplateCacheService) {
        }

        public link: angular.IDirectiveLinkFn = (
            scope: angular.IScope,
            element: angular.IAugmentedJQuery,
            attrs: IMapViewHostAttributes) => {
            scope.$on(MapController.completedLoadingLayoutData, () => {
                if (attrs.templatePath !== '') {
                    // Only append a template when its path is valid.
                    var html = this.$templateCache.get(attrs.templatePath)
                    var template = angular.element(html);
                    element.append(template);
                    this.$compile(template)(scope);
                }
            });
        }
    }

    export class MapView implements angular.IDirective {
        public restrict: string = 'E';
        public scope: boolean = true;
        public templateUrl: string = 'App/mapview/map-view.html';
        constructor() {
        }
    }

    export class OnMouseWheel implements angular.IDirective {
        public restrict: string = 'A';

        constructor() {
        }

        public link: angular.IDirectiveLinkFn = (scope: IMapControllerScope, element: angular.IAugmentedJQuery,
            attrs: angular.IAttributes) => {
            /// <summary>Implements MouseWheel handler on a given scope</summary>
            /// <param name="scope" type="Object">scope</param>
            /// <param name="element" type="Object">element</param>
            /// <param name="attrs" type="Object">attributes</param>

            var mapController = scope.mapController;
            element[0].addEventListener('mousewheel', (e) => {
                if (e.wheelDelta > 0) {
                    mapController.zoomLevel = Math.round(mapController.zoomLevel * MapController.g_zoomChangeRate * 100) / 100;
                } else {
                    mapController.zoomLevel = Math.round(mapController.zoomLevel / MapController.g_zoomChangeRate * 100) / 100;
                }
                scope.$digest();
                e.preventDefault();
            }, false);
        }
    }

    export class OnMousePan implements angular.IDirective {
        public restrict: string = 'A';

        constructor() {
        }

        public link: angular.IDirectiveLinkFn = (scope: IMapControllerScope, element: angular.IAugmentedJQuery,
            attrs: angular.IAttributes) => {
            /// <summary>Implements MouseWheel handler on a given scope</summary>
            /// <param name="scope" type="Object">scope</param>
            /// <param name="element" type="Object">element</param>
            /// <param name="attrs" type="Object">attributes</param>

            var mapController = scope.mapController;
            mapController.setMousePanningCallback(element, (xDelta: number, yDelta: number) => {
                element[0].scrollLeft -= xDelta;
                element[0].scrollTop -= yDelta;
            });
        }
    }

    export var textEllipse = () => {
        return (inputText: string): string => {
            var returnVal = inputText;
            if (inputText.length > MapController.maxTextLengthInCell) {
                returnVal = inputText.substr(0, MapController.maxTextLengthInCell - 3) + "...";
            }

            return returnVal;
        };
    };

}