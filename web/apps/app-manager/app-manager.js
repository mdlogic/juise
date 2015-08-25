/*
 * CLIRA application manager
 *
 * Fetch and install CLIRA apps from a variety of sources. Also view, update 
 * or delete installed apps.
 */

var appManager = {
    view : null,
    state : {},
    mode : null,
    appList : null,
    metaDefinition : [
            { id : "name", type : "string", label : "App name", disabled : true },
            { id : "version", type : "string", label : "Version" },
            { id : "author", type : "string", label : "Author" },
            { id : "author-email", type : "string", label : "Author email" },
            { id : "app-meta-url", type : "string", label : "Metafile URL" },
            { id : "description", type : "string", label : "App description"},
            { id : "readme", type : "string", label : "Readme URL" },
            { id : "files", type : "array", label : "App file list" },
            { id : "external", type : "array", label : "External files"}
    ],
    setError : function (msg) {
        this.state = { error : msg };
        this.view.set('controller.state', this.state);
        console.error(msg);
    },
    setSource : function (src) {
        var data = {};
        data[src] = true;
        this.setView('src', data);
    },
    setSuccess : function (data) {
        this.state = { success : data };
        this.view.set('controller.state', this.state);             
    },
    setLoading : function (msg) {
        this.state = { loading : msg };
        this.view.set('controller.state', this.state);
    },
    resetState : function () {
        this.state = {};
        this.view.set('controller.state', this.state);             
    },
    setView : function (key, value) {
        this.view.set('controller.' + key, value);
    }, 
    setMode : function (val) {
        this.mode = val;
        var mode = {};
        mode[val] = true;
        this.setView('mode', mode);
    },
    getMeta : function (appName) {
        var def = $.Deferred();
        this.doAjax({
            name : appName,
            mode : 'getMeta'
        }, function (res) {
            if (res.success && res.meta) {
                var meta = res.meta;
                var list = [];
                appManager.metaDefinition.forEach(function(v, i) {
                    var data = {};
                    if (v.type == "array" && !(v.id in meta))
                        return;

                    if (v.id in meta) {
                        data.value = meta[v.id];
                        if (res.metaCreate && v.id == "files") {
                           data.value.push(appName + ".meta (Will be created)");
                        }
                    }
                    data.name = v.id;
                    data.label = v.label;
                    data[v.type] = true;
                    if ('disabled' in v)
                        data.disabled = v.disabled;
                    list.push(data);
                });
                if (res.metaCreate) 
                    appManager.setView('metaCreate', true);
                else 
                    appManager.setView('metaCreate', false);
                appManager.setView('appName', appName);
                appManager.setView('metaList', list);
            } else if (res.error) {
                appManager.setError(res.error);
            }
            def.resolve();
        });
        return def.promise();
    },
    doAjax : function (data, onSuccessCb, onErrorCb) {
        if (!onErrorCb) {
            onErrorCb = function (xhr, stat, msg) {
                error = "AJAX request failed : ";
                if (stat == "timeout")
                    error += "Request timed out";
                else 
                    error += stat;
                appManager.setError(error);
            } 
        }
        $.ajax({
            url : '/apps/app-manager/py/app-manager.py',
            data : data,
            dataType : 'json',
            success : function (res) {
                onSuccessCb(res);
            },
            error : onErrorCb,
            timeout : 10000
        });         
    },
    showAppList : function () {
        var that = this;
        var def = $.Deferred();
        this.doAjax({mode : "listApps"}, function (res) {
            if (res.success) {
                that.appList = res.appList;
                that.setView('appList', res.appList);
                def.resolve();
            }
        });
        return def.promise();
    },
    installApp : function (formData, callback) {
        this.setLoading("Installing app...")
        this.doAjax(formData, callback);
    },
    updateApp : function (appName, callback) {
        data = {
            name : appName,
            mode : 'updateApp'
        };
        this.doAjax(data, callback);
    },
    checkForUpdates : function () {
        var that = this;
        this.appList.forEach(function (app, i) {
            if (app.meta["app-meta-url"]) {
                that.doAjax({
                    mode : "checkAppUpdate",
                    url : app.meta["app-meta-url"],
                    version : app.meta.version
                }, function (res) {
                    if (res.success) { 
                        var html = "<button id='update-" + app.name + 
                            "' class='btn btn-primary update-btn btn-sm'>" + 
                            "Update</button>" + "<label>New version " + 
                            res.updateInfo['new-version'] + " available.";
                        
                         var uptoDateHtml = "<span class='glyphicon " + 
                            "glyphicon-ok-circle'></span><b>Up-to-date</b>";
                        if (res.updateInfo['new-version']) {
                            var newVer = res.updateInfo['new-version'];
                            that.view.$(".app-status#" + app.name)
                                .removeClass('app-loading')
                                .html(html);

                            that.view.$("#update-" + app.name)
                                .click(function (e) {

                                e.preventDefault();
                                $(this).html("Updating...")
                                    .prop('disabled', true);
                                $("<div class='app-loading'></div>")
                                    .insertAfter($(this));
                                
                                that.updateApp(app.name, function (res) {
                                    if (res.success) {
                                        Ember.set(app.meta, 'version', newVer);
                                        $.clira.reloadApp(app.name)
                                            .done(function () {
                                            that.view.$(".app-status#" + 
                                                app.name)
                                                .html(uptoDateHtml)
                                                .addClass('alert alert-success');
                                        });
                                    } else if (res.error) {
                                        console.err(res.error);
                                    }
                                });
                            });
                        } else {
                            that.view.$(".app-status#" + app.name)
                                .removeClass('app-loading')
                                .html(uptoDateHtml)
                                .addClass('alert alert-success');
                        }
                    } else if (res.error) {
                        var errorHtml = "<div class='alert alert-warning'>" + 
                            "<span class='glyphicon " + 
                            "glyphicon-exclamation-sign'></span>" + res.error +
                            "</div>";
                        that.view.$(".app-status#" + app.name)
                                .removeClass('app-loading')
                                .html(errorHtml);
                    }
                });
            }
        });                
    },
    getFormData : function (ctx) {
        var data = {};
        ctx.$("input:text").each(function(i) {
            if ($(this).prop('disabled') || $(this).val() == "") return;
            data[$(this).attr('name')] = $(this).val();
        });
        return data;
    }
};
Clira.appManager = {
    selectAppSrcView : Ember.View.extend({
        render : function (buffer) {
            var options = 
                "<option value='localDisk'>Local Disk</option>" + 
                "<option value='github'>Github</option>" +
                "<option value='webServer'>Web Server</option>";
            buffer.push(options);         
        },
        didInsertElement : function () {                   
            this.$("#selectAppSrc").selectric({
                onChange : function () {
                    var src = {};
                    appManager.setSource($(this).val());
                    appManager.resetState();
                }
            }); 
        }
    }),
    formInputView : Ember.View.extend({
        didInsertElement : function () {
            that = this;
            this.$("#installApp").click(function (e) {
                e.preventDefault();
                if (appManager.state.success) {
                    appManager.resetState();
                    that.$("input:text").val("");
                    that.$("input:text:first").focus();
                    $(this).html("Install");
                    return;
                }
                var data = appManager.getFormData(that);
                data.src = appManager.view.$('#selectAppSrc').val();
                appManager.installApp(data, function (res) {
                    if (res.error) {
                        appManager.setError(res.error);
                    } else if (res.success) {
                        $.clira.reloadApp(res.appName).done(function () {
                            appManager.setSuccess({
                                name : res.appName,
                                result : 'installed'
                            });
                            that.$("#installApp").html("Install another app");
                            appManager.showAppList().done(function() {
                                appManager.checkForUpdates();
                            });
                        });
                    }
                });
            });
            this.$("#metaPath").autocomplete({
                source : "/apps/app-manager/py/list-dirs.py",
                minLength : 2,
                select : function (event, ui) {
                    appManager.resetState();
                }
            });
        }                    
    }),
    refreshAppsView : Ember.View.extend({
        didInsertElement : function () {
            this.$("#refreshAppList").click(function (e){
                e.preventDefault();
                appManager.setView('appList', false);
                appManager.showAppList().done(function () {
                    appManager.checkForUpdates(); 
                });
            }); 
        }
    }),
    showAppsView : Ember.View.extend({
        didInsertElement : function () {
            this.$("#appManagerTabs").tabs();
        }
    }),
    editMetaView : Ember.View.extend({
        didInsertElement : function () {
            var that = this;
            var findInMeta = function (list, field) {
                var obj;
                list.some(function (v, i) {
                    if (v.name == field) {
                        obj = v;
                        return true;
                    }
                });
                return obj;
            };
            this.$("#resetMeta").click(function(e) {
                e.preventDefault();
                appManager.resetState();
                var appName = appManager.view.get('controller.appName');
                var controller = appManager.view.get('controller');
                Ember.set(controller, 'metaList', false);
                appManager.getMeta(appName);
            });
            this.$("#refreshFileList").click(function (e) {
                e.preventDefault();
                var appName = appManager.view.get('controller.appName');
                var metaList = appManager.view.get('controller.metaList')
                var data = { name : appName, mode : "fetchFileList" };
                var files; 
                appManager.doAjax(data, function (res) {
                    if (res.success && res.fileList) {
                        var files = findInMeta(metaList, 'files');
                        Ember.set(files, 'value', res.fileList);
                    }
                });
            });
            this.$("#saveMeta").click(function (e) {
                e.preventDefault();
                appManager.resetState();
                $(this).prop('disabled', true);
                var btn = this;
                var appName = appManager.view.get('controller.appName');
                data = appManager.getFormData(that);
                var metaList = appManager.view.get('controller.metaList');
                var files = findInMeta(metaList, 'files');
                data.files = files.value;
                data.name = appName;
                var form = { meta : JSON.stringify(data), mode : "saveMeta" };
                appManager.doAjax(form, function (res) {
                    if (res.success) {
                        var controller = appManager.view.get('controller');
                        Ember.set(controller, 'metaList', false);
                        appManager.getMeta(appName).done(function () {
                                appManager.setSuccess({
                                msg : "Successfully updated metafile!"
                            }); 
                        });
                    } else if (res.metaError) {
                        var metaList = appManager.view.get('controller.metaList');
                        var field = findInMeta(metaList, res.metaError.name);
                        Ember.set(field, 'error', res.metaError.error);
                    } 
                    $(btn).prop('disabled', false);
                });
            });
        }
    })

}
$(function($) {
    $.clira.commandFile({
        name : "app-manager",
        templatesFile : "/apps/app-manager/app-manager.hbs",
        prereqs : [
            "/external/selectric/selectric.js"
        ],
        commands : [
            {
                command : "show apps",
                help : "List all apps, update or install new apps",
                templateName : "app-manager",
                execute: function (view, cmd, parse, poss) {
                    appManager.view = view;
                    appManager.setMode('showApps');
                    appManager.setSource("localDisk");
                    
                    appManager.showAppList().done(function () {
                       appManager.checkForUpdates();
                    });
                }
            },
            {
                command : "install app",
                help : "Install an app via commandline",
                templateName : "app-manager",
                arguments : [
                    {
                        name : "url-or-path",
                        help : "App url or local path to app location",
                        type : "string",
                        nokeyword : true,
                        mandatory : true
                    }
                ],
                execute: function (view, cmd, parse, poss) {
                    appManager.view = view;
                    appManager.setMode("appUpdateCmdl");
                    var arg = poss.data["url-or-path"];
                    if (arg) {
                        var opts = {};
                        var a = document.createElement('a');
                        a.href = arg;
                        if (a.hostname == "github.com") {
                            opts.src = "github";
                            opts.url = arg;
                        } else if (a.hostname == window.location.hostname) {
                            opts.src = "localDisk";
                            opts.path = arg;
                        } else {
                            opts.src = "webServer";
                            opts.url = arg;
                        }
                        appManager.installApp(opts, function (res) {
                            if (res.error) {
                                appManager.setError(res.error);
                            } else if (res.success) {
                                $.clira.reloadApp(res.appName).done(function(){
                                    appManager.setSuccess({
                                        name : res.appName,
                                        result : 'installed'
                                    });
                                });
                            }
                        });
                        
                    }
                }
            },
            {
                command : "update app",
                help : "Update an app via commandline",
                templateName : "app-manager",
                arguments : [
                    {
                        name : "app-name",
                        help : "Name of application to be updated",
                        type : "string",
                        nokeyword : true,
                        mandatory : true
                    }
                ],
                execute: function (view, cmd, parse, poss) {
                    appManager.view = view;
                    appManager.setMode("appUpdateCmdl");
                    var appName = poss.data["app-name"];
                    appManager.setLoading("Updating '" + appName + "' app...");
                    appManager.updateApp(appName, function (res) {
                        if (res.success) {
                            if (res['up-to-date']) {
                                appManager.setSuccess({
                                    name : appName,
                                    uptodate : true,
                                }); 
                            } else {
                                $.clira.reloadApp(appName).done(function(){
                                    appManager.setSuccess({
                                        name : appName,
                                        result : 'updated',
                                        version : res['new-version']
                                    });
                                });
                            }
                        } else if (res.error) {
                            appManager.setError(res.error);
                        }
                    });
                }
            },
            {
                command : "edit metafile",
                help : "Create or edit an application metafile",
                templateName : "app-manager",
                arguments : [
                    {
                        name : "app-name",
                        help : "Update metafile belonging to app-name",
                        type : "string",
                        nokeyword : true,
                        mandatory : true
                    }
                ],
                execute: function (view, cmd, parse, poss) {
                    appManager.view = view;
                    appManager.setMode("editMeta");
                    var appName = poss.data["app-name"];
                    appManager.getMeta(appName);
                }
            }
        ] 
    });
});
