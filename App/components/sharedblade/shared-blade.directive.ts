//  Copyright (c) Microsoft Corporation. All rights reserved
//  sharedblade-directive.js
//  The implementation of left shared blade control. 

/// <reference path="../../../Scripts/typings/angularjs/angular.d.ts" />

namespace SketchSvg {
    'use strict';

    export class SharedBlade implements angular.IDirective {
        public restrict = 'Element';
        public scope = {
            blades: '=',
        };
        public templateUrl = 'App/components/sharedblade/shared-blade.template.html';

        constructor(private $filter: angular.IFilterService) {
        }

        public link: angular.IDirectiveLinkFn = (scope: ISharedBladeScope, element: angular.IAugmentedJQuery, attrs: angular.IAttributes) => {
            var filter = this.$filter;

            scope.toggleCollapsedStates = function (selectedblade: IBlade) {
                this.blades.forEach((blade: IBlade) => {
                    if (blade !== selectedblade) {
                        blade.collapsed = true;
                    }
                });
                selectedblade.collapsed = !selectedblade.collapsed;
            }
        }
    }

    export interface ISharedBladeScope extends angular.IScope {
        toggleCollapsedStates(selectedblade: IBlade): void;
    }
}
