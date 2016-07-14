// Copyright (c) Microsoft Corporation. All rights reserved
//  app.js
//  The implementation of SketchSvg app module

/// <reference path="../Scripts/typings/angularjs/angular.d.ts" />
/// <reference path="../Scripts/typings/angularjs/angular-route.d.ts" />
/// <reference path="../Scripts/typings/angularui/angular-ui-router.d.ts" />
/// <reference path="dcpicker/shared-blade-metro-data-center.controller.ts" />
/// <reference path="defs/adal-angular.d.ts" />
/// <reference path="defs/common-types.d.ts" />
/// <reference path="components/feedback/planning-feedback.controller.ts" />
/// <reference path="components/notification/notification.controller.ts" />
/// <reference path="components/notification/notification.directive.ts" />
/// <reference path="components/sharedblade/shared-blade.directive.ts" />
/// <reference path="mapview/colocation-map.directive.ts" />
/// <reference path="mapview/layout-view.directive.ts" />
/// <reference path="mapview/map-portal-view.directive.ts" />
/// <reference path="mapview/map-view.directive.ts" />
/// <reference path="powerdevices/power-list.controller.ts" />
/// <reference path="reservation/tile-selector.directive.ts" />

// Global varibales that are read from config and set while app loading.
declare var idaLoginUrl: string;
declare var idaTenant: string;
declare var idaClientId: string;
declare var urlSketchServer: string;

module SketchSvg {
    'use strict';

    var app = angular.module('SketchSvg', [
        'ngRoute', 'ngResource', 'ui.router',
        'ngAnimate', 'ui.bootstrap', 'ui.bootstrap.tpls',
        'ui.bootstrap.modal', 'ui.bootstrap.popover', 'AdalAngular']);

    app.controller('AppController', () => { });
    app.controller('PlanningController', PlanningController);
    app.controller('MapController', MapController);
    app.controller('LayoutViewController', LayoutViewController);
    app.controller('TileSelectorController', TileSelectorController);
    app.controller('SharedBladeMetroDataCenterController', SharedBladeMetroDataCenterController);
    app.controller('SharedBladePendingActionsController', SharedBladePendingActionsController);
    app.controller('PowerListController', PowerListController);
    app.controller('NotificationController', NotificationController);
    app.controller('PortalViewController', PortalViewController);
    app.controller('PlanningFeedbackController', PlanningFeedbackController);

    app.directive('colocationMap', ['$compile', '$templateCache', ($compile, $templateCache) => new ColocationMap($compile, $templateCache)]);
    app.directive('mapView', () => new MapView());
    app.directive('mapViewHost', ['$compile', '$templateCache', ($compile, $templateCache) => new MapViewHost($compile, $templateCache)]);
    app.directive('layoutView', () => new LayoutView());
    app.directive('tileSelector', ['$compile', '$templateRequest', ($compile, $templateRequest) => new TileSelector($compile, $templateRequest)]);
    app.directive('onMouseWheel', () => new OnMouseWheel());
    app.directive('onMousePan', () => new OnMousePan());
    app.directive('sharedBlade',['$filter', ($filter) => new SharedBlade($filter)]);
    app.directive('bladeContent',['$templateRequest','$compile', ($templateRequest,$compile) => new BladeContent($templateRequest,$compile)]);
    app.directive('pendingActionslist', () => new PendingActionslist());
    app.directive('notification', () => new Notification());

    app.filter('textEllipse', textEllipse);
    app.filter('tileSelectionCount', tileSelectionCount);
    app.filter('filterPropertyGroupCSSClass', RackDetailRendererFactory.filterCSSClassName);
    app.filter('requestFulfillmentStatusDisplay', requestFulfillmentStatusDisplay);

    app.factory('dataModelService', ['dataLoader', '$log', '$q', (dataLoader, $log, $q) => new DataModelService(dataLoader, $log, $q)]);
    app.factory('dataLoadingProgress', [() => new DataLoadingProgress()]);
    app.factory('dataLoader', ['$log', '$q', '$http', ($log, $q, $http) => new DataLoader($log, $q, $http)]);
    app.factory('rackDetailRendererFactory', ['dataModelService', '$log', '$q', (dataModelService, $log, $q) => new RackDetailRendererFactory(dataModelService, $log, $q)]);
    app.factory('spaceRendererFactory', ['$log', '$q', ($log, $q) => new SpaceRendererFactory($log, $q)]);
    app.factory('powerCoolingRenderFactory', ['dataModelService', '$log', '$q', (dataModelService, $log, $q) => new PowerCoolingRenderFactory(dataModelService, $log, $q)]);

    app.factory('reservationDetailRendererService',
        ['dataModelService', '$log', '$q',
        (dataModelService, $log, $q) => new ReservationDetailRendererService(dataModelService, $log, $q)]);

    app.factory('notificationService', () => new NotificationService());

    app.config([
        '$routeProvider',
        '$locationProvider',
        '$stateProvider',
        '$urlRouterProvider',
        '$httpProvider',
        'adalAuthenticationServiceProvider',
        ($routeProvider: angular.route.IRouteProvider,
         $locationProvider: angular.ILocationProvider,
         $stateProvider: angular.ui.IStateProvider,
         $urlRouterProvider: angular.route.IRouteProvider,
         $httpProvider: angular.IHttpProvider,
         adalProvider: adal.AdalAuthenticationServiceProvider) => {
            $urlRouterProvider.otherwise('/');
            $stateProvider.state('home', {
                url: '/',
                templateUrl: '/App/planning/planning.template.html',
                requireADLogin: true
            }).state('plannerFeedbackRequest', {
                url: 'plannerFeedbackRequest?dcId&coloId&groupId',
                parent: 'home',
                onEnter: ['$rootScope', '$stateParams',
                    ($rootScope: angular.IRootScopeService, $stateParams: any) => {
                        $rootScope.$broadcast('feedbackRequest', {
                            dcId: $stateParams.dcId,
                            coloId: $stateParams.coloId,
                            groupId: $stateParams.groupId,
                        });
                    }
                ],
                requireADLogin: true
            }).state('colo', {
                url: '/colocation/:coloId/:portalMode?',
                templateUrl: '/App/mapview/map-portal-view.html',
                requireADLogin: true   
            }).state('dc', {
                url: '/dc/:dcId/:portalMode?',
                templateUrl: '/App/mapview/map-portal-view.html',
                requireADLogin: true
            });

            var additionalEndPoints = {};
            additionalEndPoints[urlSketchServer] = idaClientId;

            adalProvider.init({
                loginResource: idaLoginUrl, 
                tenant: idaTenant,
                clientId: idaClientId,
                extraQueryParameter: 'nux=1',
                endpoints: additionalEndPoints
                //cacheLocation: 'localStorage', // enable this for IE, as sessionStorage does not work for localhost.
            },
            $httpProvider);

            $locationProvider.html5Mode(false);
        }]);
}
