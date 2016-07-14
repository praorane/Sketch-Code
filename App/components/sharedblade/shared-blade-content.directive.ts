//  Copyright (c) Microsoft Corporation. All rights reserved
//  sharedblade-directive.js
//  The implementation of left shared blade control. 

/// <reference path="../../../Scripts/typings/angularjs/angular.d.ts" />

namespace SketchSvg {
    'use strict';

    export interface IBladeContentAttrs extends angular.IAttributes {
        templatePath: string;
    }

    export class BladeContent implements angular.IDirective {
        public restrict = 'AE';
        public scope = true;
        public replace = true;

        constructor(private $templateRequest: angular.ITemplateRequestService, private $compile: angular.ICompileService) {
        }

        public link: angular.IDirectiveLinkFn = (scope: angular.IScope, element: angular.IAugmentedJQuery, attrs: IBladeContentAttrs) => {
            if (attrs.templatePath !== '') {
                // Only append a template when its path is valid.
                this.$templateRequest(attrs.templatePath).then((html: string): void => {
                    var template = angular.element(html);
                    element.append(template);
                    this.$compile(template)(scope);
                });
            }
        }
    }
}