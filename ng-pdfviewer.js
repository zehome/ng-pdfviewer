/**
 * @preserve AngularJS PDF viewer directive using pdf.js.
 *
 * https://github.com/akrennmair/ng-pdfviewer
 *
 * MIT license
 */

angular.module('ngPDFViewer', []).
directive('pdfviewer',
[ '$parse', '$q', '$window',
function($parse, $q, $window) {
    var canvas = null;
    var viewer_container = null;
    var instance_id = null;

    return {
        restrict: "E",
        template: '<canvas></canvas>',
        scope: {
            onPageLoad: '&',
            loadProgress: '&',
            src: '@',
            id: '='
        },
        controller: [ '$scope', function($scope) {
            $scope.pageNum = 1;
            $scope.pdfDoc = null;
            $scope.scale = 1.5;
            $scope.pageWidth = 0;
            $scope.pageHeight = 0;

            $scope.documentProgress = function(progressData) {
                if ($scope.loadProgress) {
                    $scope.loadProgress({state: "loading", loaded: progressData.loaded, total: progressData.total});
                }
            };

            $scope.loadPDF = function(path) {
                PDFJS.getDocument(path, null, null, $scope.documentProgress).then(function(_pdfDoc) {
                    $scope.pdfDoc = _pdfDoc;
                    $scope.renderPage($scope.pageNum, function(success) {
                        if ($scope.loadProgress) {
                            $scope.loadProgress({state: "finished", loaded: 0, total: 0});
                        }
                    });
                }, function(message, exception) {
                    console.log("PDF load error: " + message);
                    if ($scope.loadProgress) {
                        $scope.loadProgress({state: "error", loaded: 0, total: 0});
                    }
                });
            };

            $scope.renderPage = function(num, callback) {
                if ($scope.pdfDoc) {
                    $scope.pdfDoc.getPage(num).then(function(page) {
                        var viewport = page.getViewport($scope.scale);
                        var ctx = canvas.getContext('2d');
                        if ($scope.scale == 1) {
                            $scope.pageHeight = viewport.height;
                            $scope.pageWidth = viewport.width;
                        }
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;

                        $q.all([
                            page.render({ canvasContext: ctx, viewport: viewport })
                        ]).then(
                            function() {
                                if (callback) { callback(true); }
                                $scope.onPageLoad({ page: $scope.pageNum, total: $scope.pdfDoc.numPages });
                            },
                            function() {
                                if (callback) { callback(false); }
                            }
                        );
                    });
                }
            };

            $scope.$on('pdfviewer.nextPage', function(evt, id) {
                if (id !== instance_id) {
                    return;
                }

                if ($scope.pageNum < $scope.pdfDoc.numPages) {
                    $scope.pageNum++;
                    $scope.renderPage($scope.pageNum);
                }
            });

            $scope.$on('pdfviewer.prevPage', function(evt, id) {
                if (id !== instance_id) {
                    return;
                }

                if ($scope.pageNum > 1) {
                    $scope.pageNum--;
                    $scope.renderPage($scope.pageNum);
                }
            });

            $scope.$on('pdfviewer.gotoPage', function(evt, id, page) {
                if (id !== instance_id) {
                    return;
                }

                if (page >= 1 && page <= $scope.pdfDoc.numPages) {
                    $scope.pageNum = page;
                    $scope.renderPage($scope.pageNum);
                }
            });

            $scope.$on('pdfviewer.changeZoom', function(evt, id, zoom) {
                if (id !== instance_id) {
                    return;
                }
                if (zoom !== $scope.zoom) {
                    if (zoom === "width") {
                        if ($scope.pageWidth <= 0) {
                            $scope.pageWidth = 600;
                        }
                        zoom = $scope.availableWidth / $scope.pageWidth;
                    }
                    if (zoom < 0.5) {
                        zoom = 0.5;
                    }
                    $scope.scale = zoom;
                }
            });

            $scope.$watch('scale', function(scale) {
                $scope.renderPage($scope.pageNum);
            });

            /* Watch window resize for "fit to width" */
            angular.element($window).bind('resize', function() {
                $scope.availableWidth = viewer_container.clientWidth;
            });
        } ],
        link: function(scope, iElement, iAttr) {
            canvas = iElement.find('canvas')[0];
            viewer_container = iElement.parent()[0];
            instance_id = iAttr.id;
            iAttr.$observe('src', function(v) {
                if (v !== undefined && v !== null && v !== '') {
                    scope.pageNum = 1;
                    scope.availableWidth = viewer_container.clientWidth;
                    scope.loadPDF(scope.src);
                }
            });
        }
    };
}]).
service("PDFViewerService", [ '$rootScope', function($rootScope) {

    var svc = { };
    svc.nextPage = function() {
        $rootScope.$broadcast('pdfviewer.nextPage');
    };

    svc.prevPage = function() {
        $rootScope.$broadcast('pdfviewer.prevPage');
    };

    svc.Instance = function(id) {
        var instance_id = id;

        return {
            prevPage: function() {
                $rootScope.$broadcast('pdfviewer.prevPage', instance_id);
            },
            nextPage: function() {
                $rootScope.$broadcast('pdfviewer.nextPage', instance_id);
            },
            gotoPage: function(page) {
                $rootScope.$broadcast('pdfviewer.gotoPage', instance_id, page);
            },
            changeZoom: function(zoom) {
                $rootScope.$broadcast('pdfviewer.changeZoom', instance_id, zoom);
            }
        };
    };

    return svc;
}]);
