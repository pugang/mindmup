/*jslint nomen: true*/
/*global _gaq, document, jQuery, MM, MAPJS, window*/
MM.main = function (config) {
	'use strict';
	var getStorage = function () {
			try {
				window.localStorage.setItem('testkey', 'testval');
				if (window.localStorage.getItem('testkey') === 'testval') {

					return window.localStorage;
				}
			} catch (e) {
			}
			return {
				fake: true,
				getItem: function (key) { return this[key]; },
				setItem: function (key, val) { this[key] = val; },
				removeItem: function (key) { delete this[key]; }
			};
		},
		browserStorage = getStorage(),
		mapModelAnalytics = false,
		setupTracking = function (activityLog, jotForm, mapModel) {
			activityLog.addEventListener('log', function () { _gaq.push(['_trackEvent'].concat(Array.prototype.slice.call(arguments, 0, 3))); });
			activityLog.addEventListener('error', function (message) {
				jotForm.sendError(message, activityLog.getLog());
			});
			if (mapModelAnalytics) {
				mapModel.addEventListener('analytic', activityLog.log);
			}
		};
	window._gaq = [['_setAccount', config.googleAnalyticsAccount],
		['_setCustomVar', 1, 'User Cohort', config.userCohort, 1],
		['_setCustomVar', 2, 'Active Extensions', browserStorage['active-extensions'], 1],
		['_trackPageview']
			];
	jQuery(function () {
		var activityLog = new MM.ActivityLog(10000),
			oldShowPalette,
			alert = new MM.Alert(),
			objectStorage = MM.jsonStorage(browserStorage),
			jotForm = new MM.JotForm(jQuery('#modalFeedback form'), alert),
			s3Adapter = new MM.S3Adapter(config.s3Url, config.s3Folder, activityLog, config.publishingConfigUrl, config.baseUrl + config.proxyLoadUrl),
			googleDriveAdapter = new MM.GoogleDriveAdapter(config.googleAppId, config.googleClientId, config.googleApiKey, config.networkTimeoutMillis, 'application/json'),
			offlineMapStorage = new MM.OfflineMapStorage(objectStorage, 'offline'),
			offlineAdapter = new MM.OfflineAdapter(offlineMapStorage),
			mapController = new MM.MapController([
				new MM.RetriableMapSourceDecorator(new MM.FileSystemMapSource(s3Adapter)),
				new MM.RetriableMapSourceDecorator(new MM.FileSystemMapSource(googleDriveAdapter)),
				new MM.FileSystemMapSource(offlineAdapter),
				new MM.EmbeddedMapSource()
			]),
			navigation = MM.navigation(browserStorage, mapController),
			mapModel = new MAPJS.MapModel(MAPJS.KineticMediator.layoutCalculator, [''], ['']),
			mapBookmarks = new MM.Bookmark(mapController, objectStorage, 'created-maps'),
			autoSave = new MM.AutoSave(mapController, objectStorage, alert),
			extensions = new MM.Extensions(browserStorage, 'active-extensions', config, {
				'googleDriveAdapter': googleDriveAdapter,
				'alert': alert,
				'mapController': mapController,
				'activityLog': activityLog,
				'mapModel': mapModel,
				'container': jQuery('#container')
			});
		config.isTouch = jQuery('body').hasClass('ios') || jQuery('body').hasClass('android');
		MM.OfflineMapStorageBookmarks(offlineMapStorage, mapBookmarks);
		jQuery.support.cors = true;
		setupTracking(activityLog, jotForm, mapModel);
		jQuery('body').classCachingWidget('cached-classes', browserStorage);
		jQuery('body').mapStatusWidget(mapController);
		if (!jQuery('body').hasClass('image-render-checked')) {
			if (config.isTouch) {
				jQuery('body').addClass('image-render');
			}
			jQuery('body').addClass('image-render-checked');
		}
		jQuery('#container').mapWidget(activityLog, mapModel, config.isTouch, jQuery('body').hasClass('image-render'));
		jQuery('#welcome_message[data-message]').welcomeMessageWidget(activityLog);
		jQuery('#topbar').alertWidget(alert).mapToolbarWidget(mapModel);




		jQuery('.colorPicker-palette').addClass('topbar-color-picker');
		oldShowPalette = jQuery.fn.colorPicker.showPalette;
		jQuery.fn.colorPicker.showPalette = function (palette) {
			oldShowPalette(palette);
			if (palette.hasClass('topbar-color-picker')) {
				palette.css('top', jQuery('#topbar').outerHeight());
			}
		};

		jQuery('#modalFeedback').feedbackWidget(jotForm, activityLog);
		jQuery('#modalVote').voteWidget(activityLog, alert);
		jQuery('#toolbarEdit').mapToolbarWidget(mapModel);
		jQuery('#floating-toolbar').floatingToolbarWidget();
		jQuery('#listBookmarks').bookmarkWidget(mapBookmarks, alert, mapController);
		jQuery(document).titleUpdateWidget(mapController);
		jQuery('[data-mm-role=share]').shareWidget();
		jQuery('#modalShareEmail').shareEmailWidget();
		jQuery('[data-mm-role=share-google]').googleShareWidget(mapController, googleDriveAdapter);
		jQuery('[data-mm-role=share]').add('[data-mm-role=short-url]').urlShortenerWidget(config.googleApiKey, activityLog, mapController, config.baseUrl);
		jQuery('#modalImport').importWidget(activityLog, mapController);
		jQuery('[data-mm-role=save]').saveWidget(mapController);
		jQuery('[data-mm-role="toggle-class"]').toggleClassWidget();
		jQuery('[data-mm-role="remote-export"]').remoteExportWidget(mapController, alert);
		jQuery('#modalGoogleOpen').googleDriveOpenWidget(googleDriveAdapter, mapController);
		jQuery('#modalLocalStorageOpen').localStorageOpenWidget(offlineMapStorage, mapController);
		jQuery('body')
			.commandLineWidget('Shift+Space Ctrl+Space', mapModel);
		jQuery('#modalAttachmentEditor').attachmentEditorWidget(mapModel, config.isTouch);
		jQuery('#modalAutoSave').autoSaveWidget(autoSave);
		jQuery('#linkEditWidget').linkEditWidget(mapModel);
		jQuery('#modalExtensions').extensionsWidget(extensions, mapController, alert);
		MM.MapController.activityTracking(mapController, activityLog);
		MM.MapController.alerts(mapController, alert);
		mapController.addEventListener('mapLoaded', function (mapId, idea) {
			mapModel.setIdea(idea);
		});
		jQuery('#nodeContextMenu').contextMenuWidget(mapModel).mapToolbarWidget(mapModel);
		if (browserStorage.fake) {
			alert.show('Browser storage unavailable!', 'You might be running the app in private mode or have no browser storage - some features of this application will not work fully.', 'warning');
			activityLog.log('Warning', 'Local storage not available');
		}
		extensions.load().then(function () {
			if (!config.isTouch) {
				jQuery('[rel=tooltip]').tooltip();
			}
			jQuery('.dropdown-submenu>a').click(function () { return false; });
			jQuery('[data-category]').trackingWidget(activityLog);
			jQuery('.modal')
				.on('show', mapModel.setInputEnabled.bind(mapModel, false))
				.on('hide', mapModel.setInputEnabled.bind(mapModel, true));
			jQuery('#modalKeyActions').keyActionsWidget();
			if (!navigation.loadInitial()) {
				jQuery('#logo-img').click();
			}

			jQuery('.updateStyle').colorPicker();
			jQuery('.colorPicker-picker').parent('a,button').click(function (e) { if (e.target === this) {jQuery(this).find('.colorPicker-picker').click(); } });

		});
	});

};
