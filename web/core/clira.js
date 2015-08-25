/*
 * $Id$
 *  -*-  indent-tabs-mode:nil -*-
 * Copyright 2011, Juniper Network Inc.
 * All rights reserved.
 * This SOFTWARE is licensed under the LICENSE provided in the
 * ../Copyright file. By downloading, installing, copying, or otherwise
 * using the SOFTWARE, you agree to be bound by the terms of that
 * LICENSE.
 */

jQuery(function ($) {
    var $output = $("#output-top");
    var muxer;
    var command_number = 0;
    var tgtHistory;
    var renderBuffer = {};

    var loadingMessage = "<img src='/images/icons/loading.png'>"
        + "    ....loading...\n";

    if ($.clira == undefined)
        $.clira = { };

    $.extend($.clira, {
        decorateIcons: function decorateIcons ($wrapper) {
            // Our container decorations (which need some of our functions)
            $(".icon-remove-section", $wrapper).text("Close").button({
                text: false,
                icons: { primary: "ui-icon-closethick" }
            }).click(function () {
                divRemove($wrapper);
            });

            $(".icon-hide-section", $wrapper).text("Hide").button({
                text: false,
                icons: { primary: "ui-icon-minusthick" }
            }).click(function () {
                divHide($wrapper);
            });

            $(".icon-unhide-section", $wrapper).text("Unhide").button({
                text: false,
                icons: { primary: "ui-icon-plusthick" }
            }).click(function () {
                divUnhide($wrapper);
            }).addClass("hidden");

            $(".icon-clear-section", $wrapper).text("Clear").button({
                text: false,
                icons: { primary: "ui-icon-trash" }
            }).click(function () {
                $(".can-hide", $wrapper).text("");
            });

            $(".icon-keeper-section", $wrapper).text("Keep").button({
                text: false,
                icons: { primary: "ui-icon-star" }
            }).click(function () {
                $wrapper.toggleClass("keeper-active");
                $(this).toggleClass("ui-state-highlight");
            });
        },

        makeAlert: function makeAlert (view, message, defmessage) {
            if (message == undefined || message.length == 0)
                message = defmessage;
            var content = '<div class="ui-state-error ui-corner-all">'
                + '<span><span class="ui-icon ui-icon-alert">'
                + '</span>';
            content += '<strong>Error:</strong> ' + message + '</span></div>';
            view.get('controller').set('output', content);
        },

        refocus: function () {
            if (tgtHistory.value())
                $.clira.cmdHistory.focus();
            else tgtHistory.focus();
        },

        /*
         * Executes given command and inserts output container into the page
         */
        executeCommand: function executeCommand (command, content) {
            var parse = $.clira.parse(command);

            if (parse.possibilities.length > 0) {
                var poss = parse.possibilities[0];
                content.contentTemplate = poss.command.templateName;
                content.poss = poss;            

                if (content.commandNumber == undefined) {
                    if ($.clira.commandCount) {
                        content.commandNumber = ++$.clira.commandCount;
                    } else {
                        $.clira.commandCount = 1;
                        content.commandNumber = 1;
                    }
                }
                
                Clira.__container__.lookup('controller:outputs')
                     .unshiftObject(Clira.OutputContainerController
                                         .create(content));
            }
        }
    });

    $.dbgpr("document is ready");

    var testForms = {
        first: {
            title: "Ping Options",
            command: {
                rpc: "ping"
            },
            tabs: { },
            css: "/css/ping.css",
            fieldsets: [
                {
                    legend: "Basic",
                    fields: [
                        {
                            name: "host",
                            title: "Hostname or IP address of remote host",
                            type: "text"
                        },
                        {
                            name: "count",
                            title: "Number of ping requests to send",
                            type: "number",
                            range: "1..2000000000",
                            units: "packets"
                        },
                        {
                            name: "interval",
                            title: "Delay between ping requests",
                            units: "seconds",
                            type: "number"
                        },
                        {
                            name: "no-resolve",
                            title: "Don't attempt to print addresses symbolically",
                            type: "boolean"
                        },
                        {
                            name: "size",
                            title: "Size of request packets",
                            type: "number",
                            units: "bytes",
                            range: "0..65468"
                        },
                        {
                            name: "wait",
                            title: "Delay after sending last packet",
                            type: "number",
                            units: "seconds"
                        }
                    ]
                },
                {
                    legend: "Outgoing",
                    fields: [
                        {
                            name: "bypass-routing",
                            title: "Bypass routing table, use specified interface",
                            type: "boolean"
                        },
                        {
                            name: "do-not-fragment",
                            title: "Don't fragment echo request packets (IPv4)",
                            type: "boolean"
                        },
                        {
                            name: "inet",
                            title: "Force ping to IPv4 destination",
                            type: "boolean"
                        },
                        {
                            name: "inet6",
                            title: "Force ping to IPv6 destination",
                            type: "boolean"
                        },
                        {
                            name: "logical-system",
                            title: "Name of logical system",
                            type: "string"
                        },
                        {
                            name: "interface",
                            title: "Source interface (multicast, all-ones, unrouted packets)",
                            type: "interface-name"
                        },
                        {
                            name: "routing-instance",
                            title: "Routing instance for ping attempt",
                            type: "string"
                        },
                        {
                            name: "source",
                            title: "Source address of echo request",
                            type: "ip-address"
                        }
                    ]
                },
                {
                    legend: "ICMP",
                    fields: [
                        {
                            name: "loose-source",
                            title: "Intermediate loose source route entry (IPv4)",
                            type: "boolean"
                        },
                        {
                            name: "record-route",
                            title: "Record and report packet's path (IPv4)",
                            type: "boolean"
                        },
                        {
                            name: "strict",
                            title: "Use strict source route option (IPv4)",
                            type: "boolean"
                        },
                        {
                            name: "strict-source",
                            title: "Intermediate strict source route entry (IPv4)",
                            type: "boolean"
                        }
                    ]
                },
                {
                    legend: "Advanced",
                    fields: [
                        {
                            name: "detail",
                            title: "Display incoming interface of received packet",
                            type: "boolean"
                        },
                        {
                            name: "verbose",
                            title: "Display detailed output",
                            type: "boolean"
                        },
                        {
                            name: "mac-address",
                            title: "MAC address of the nexthop in xx:xx:xx:xx:xx:xx format",
                            type: "mac-address"
                        },
                        {
                            name: "pattern",
                            title: "Hexadecimal fill pattern",
                            type: "string"
                        },
                        {
                            name: "rapid",
                            title: "Send requests rapidly (default count of 5)",
                            type: "boolean"
                        },
                        {
                            name: "tos",
                            title: "IP type-of-service value",
                            type: "number",
                            range: "0..255"
                        },
                        {
                            name: "ttl",
                            title: "IP time-to-live value (IPv6 hop-limit value)",
                            type: "number",
                            units: "hops",
                            range: "0..63"
                        }

                    ]
                }
            ]
        }
    }

    function parseParams (cmdline) {
        var argv = cmdline.split(" ");
        var params = { };
        for (var i = 0; i < argv.length; i += 2) {
            params[argv[i]] = argv[i + 1];
        }
        return params;
    }

    function openMuxer () {
        if (muxer) {
            return;
        }

        muxer = $.Muxer({
            url: $.clira.prefs.mixer,
            onopen: function (event) {
                $.dbgpr("clira: WebSocket has opened");
            },
            onreply: function (event, data) {
                $.dbgpr("clira: onreply: " + data);
            },
            oncomplete: function (event) {
                $.dbgpr("clira: complete");
            },
            onclose: function (event) {
                $.dbgpr("clira: WebSocket has closed");
                // This muxer has been closed.  Completely nuke it since we
                // only hold one muxer in memory per browser instance.
                muxer = undefined;
            },
            onhostkey: function (view, data) {
                var self = this;
                promptForHostKey(view, data, function (response) {
                    muxer.hostkey(self, response, data);
                });
            },
            onpsphrase: function (view, data) {
                var self = this;
                promptForSecret(view, data, function (response) {
                        muxer.psphrase(self, response, data);
                }, function() {
                    $.clira.makeAlert(view,
                        "Incorrect or unspecified passphrase");
                });
            },
            onpsword: function (view, data) {
                var self = this;
                promptForSecret(view, data, function (response) {
                    muxer.psword(self, response, data);
                }, function() {
                    $.clira.makeAlert(view, 
                        "Incorrect or unspecified password");
                });
            }
        });

        muxer.open();
    }

    function restoreReplaceDiv ($div) {
        $.clira.cmdHistory.focus();
        $div.parent().html(loadingMessage);
        $div.remove();
    }

    $.extend($.clira, {
        muxer: function () {
            if (muxer == undefined || muxer.failed) {
                openMuxer();
            }
            return muxer;
        },
        runCommand: function runCommand (view, target, command, format, onComplete) {
            this.runCommandInternal(view, target, command, format, onComplete);
        },        
        /*
         * runCommandInternal takes additional parameters that dictates how to
         * run the command. 'format' is the format in which RPC should request
         * output in and defaults to html. 'stream' is boolean when set will
         * send RPC with stream flag and receives streaming RPC output.
         * 'onReplyRender' when specified will be called with data received
         * per reply. 'onCompleteRender' will be run once the RPC is completed
         */
        runCommandInternal: function runCommandInternal (view, target, command,
                                                         format, onComplete,
                                                         stream, onReplyRender,
                                                         onCompleteRender) {
            var output = null,
                domElement = false;
            
            /*
             * If runCommand is called without a view, create a pseudo view
             * and use for pop ups that need user input. If user explicitly
             * passes null for view, he wants to simply run the command and
             * return output
             */
            if (view) {
                if (view instanceof jQuery) {
                    output = view;
                    domElement = true;
                    var pseudoView = Ember.View.extend({
                        init: function() {
                            this._super();
                            this.set('controller', Ember.Controller.create());
                        }
                    });
                    view = Ember.View.views["pseudo_view"]
                                .createChildView(pseudoView);
                    view.appendTo(output);
                } else {
                    output = view.$();
                }

                if (domElement) {
                    output.html(loadingMessage);
                } else {
                    view.get('controller').set('output', loadingMessage);
                }
            }

            if (muxer == undefined)
                openMuxer();

            // Set muxer on the controller
            if (view) view.set('controller.muxer', muxer);

            var full = [ ];
            var payload = "<command format=";

            if (format) {
                payload += "'" + format + "'";
            } else {
                payload += "'html'";
            }

            if (stream) {
                payload += " stream='stream'";
            }

            payload += ">" + command + "</command>";
            var op = '',
                cache = [];
            muxer.rpc({
                div: output,
                view: view,
                target: target,
                payload: payload,
                onreply: function (data) {
                    data = data.replace(/<rpc-reply .*>/, "")
                               .replace(/<\/rpc-reply>/, "");
                    $.dbgpr("rpc: reply: full.length " + full.length
                            + ", data.length " + data.length);
                    full.push(data);

                    // Turns out that if we continually pass on incoming
                    // data, firefox becomes overwhelmed with the work
                    // of rendering it into html.  We cheat here by
                    // rendering the first piece, and then letting the
                    // rest wait until the RPC is complete.  Ideally, there
                    // should also be a timer to render what we've got if
                    // the output RPC stalls.
                    if (stream) {
                        cache.push(data);
                        if (cache.length > 5) {
                            cache = cache.splice(cache.length - 5);
                        }
                        op = cache.join("");
                    } else {
                        op = full.join("");
                    }

                    if (stream || full.length <= 2) {
                        if (view) {
                            if (domElement) {
                                output.html(data);
                            } else {
                                if (onReplyRender) {
                                    view.get('controller')
                                        .set('output',
                                             onReplyRender(op));
                                } else {
                                    view.get('controller')
                                        .set('output', op);
                                }
                            }
                        }
                    }
                },
                oncomplete: function () {
                    $.dbgpr("rpc: complete");
                    if (view) {
                        if (domElement) {
                            output.html(full.join(""));
                        } else {
                            view.get('controller').set('completed', true);
                            if (onCompleteRender) {
                                view.get('controller')
                                    .set('output', 
                                onCompleteRender(full.join("")));
                            } else {
                                view.get('controller')
                                    .set('output', full.join(""));
                            }
                        }

                        // Add this device to list of recently used devices
                        view.get('controller').get('controllers.recentDevices')
                                              .addDevice(target);
                    }

                    if ($.isFunction(onComplete)) {
                        onComplete(view, true, full.join(""));
                    }
                },
                onclose: function (event, message) {
                    if (stream) {
                        this.oncomplete();
                    }
                    $.dbgpr("muxer: rpc onclose");
                    if (full.length == 0) {
                        $.clira.makeAlert(view, message,
                                          "internal failure (websocket)");
                        if ($.isFunction(onComplete)) {
                            onComplete(view, false, output);
                        }
                    }
                },
                onerror: function (message) {
                    $.dbgpr("muxer: rpc onerror");
                    if (full.length == 0) {
                        if (view) {
                            $.clira.makeAlert(view, message,
                                        "internal failure (websocket)");
                        }
                        if ($.isFunction(onComplete)) {
                            onComplete(view, false, output);
                        }
                    }
                }
            });
        },
        
        /*
         * Load merges and commits given configuration to target device.
         * Default config format is text.
         */
        configure: function(target, config, onComplete, format) {
            $.clira.loadConfig(target, config, function(status, data) {
                if (status) {
                    $.clira.commitConfig(target, false, onComplete);
                } else {
                    onComplete(status, data);
                }
            }, format);
        },

        /*
         * Loads given configuration and returns the status to onComplete
         * callback. First argument to callback is status which is true when
         * load succeded and false when failure. Second argument contains any
         * messages from loading configuration. Default action is merge
         */
        loadConfig: function (target, config, onComplete, format, action, view) {
            if (muxer == undefined)
                openMuxer();

            var full = [],
                success = true,
                payload = "<load-configuration";

            if (format) {
                payload += " format='" + format + "'";
            } else {
                payload += " format='text'";
            }

            if (action) {
                payload += " action='" + action + "'";
            } else {
                payload += " action='merge'";
            }

            if (format === "xml") {
                // See if they already have a <configuation> tag.  If not, add
                // it
                if (config.indexOf("<configuration>") == -1) {
                    payload += "><configuration>" + config + "</configuration>";
                } else {
                    payload += ">" + config;
                }
            } else {
                if (action == "set") {
                    payload += "><configuration-set>" + config
                        + "</configuration-set>";
                } else if (action == "patch") {
                    payload += "><configuration-patch>" + config
                        + "</configuration-patch>";
                } else {
                    payload += "><configuration-text>" + config
                        + "</configuration-text>";
                }
            }
            payload += "</load-configuration>";

            muxer.rpc({
                div: null,
                view: view,
                target: target,
                payload: payload,
                onreply: function (data) {
                    $.dbgpr("load: reply: full.length " + full.length
                            + ", data.length " + data.length);
                    if (data.indexOf("<rpc-error>") != -1) 
                        success = false;
                    full.push(data);
                },
                oncomplete: function () {
                    $.dbgpr("load: complete");

                    if ($.isFunction(onComplete)) {
                        onComplete(success, full.join(""));
                    }
                },
                onclose: function (event, message) {
                    $.dbgpr("muxer: load onclose");
                    if (full.length == 0) {
                        if ($.isFunction(onComplete)) {
                            onComplete(false, output);
                        }
                    }
                },
                onerror: function (message) {
                    $.dbgpr("muxer: load onerror");
                    if ($.isFunction(onComplete)) {
                        onComplete(false, full.join(""));
                    }
                }
            });
        },

        /*
         * Issues a commit to the device
         */
        commitConfig: function(target, check, onComplete, view) {
            if (muxer == undefined)
                openMuxer();

            var full = [],
                success = true,
                payload = "<commit-configuration>";

            if (check) {
                payload += "<check/>";
            }

            payload += "</commit-configuration>";

            muxer.rpc({
                div: null,
                view: view,
                target: target,
                payload: payload,
                onreply: function (data) {
                    $.dbgpr("commit: reply: full.length " + full.length
                            + ", data.length " + data.length);
                    if (data.indexOf("<rpc-error>") != -1)
                        success = false;
                    full.push(data);
                },
                oncomplete: function () {
                    $.dbgpr("commit: complete");

                    if ($.isFunction(onComplete)) {
                        onComplete(success, full.join(""));
                    }
                },
                onclose: function (event, message) {
                    $.dbgpr("muxer: commit onclose");
                    if (full.length == 0) {
                        if ($.isFunction(onComplete)) {
                            onComplete(false, output);
                        }
                    }
                },
                onerror: function (message) {
                    $.dbgpr("muxer: commit onerror");
                    if ($.isFunction(onComplete)) {
                        onComplete(false, full.join(""));
                    }
                }
            });
        },

        /*
         * Rolls back a configuration & commits it
         */
        rollbackConfig: function(target, rollbackNumber, onComplete, view) {
            var full = [];
            var success = true;

            if (muxer == undefined) {
                openMuxer();
            }

            if (rollbackNumber == undefined) {
                rollbackNumber = 0;
            }

            muxer.rpc({
                div: null,
                view: view,
                target: target,
                payload: '<load-configuration rollback="' + rollbackNumber + '"/>',
                onreply: function (data) {
                    $.dbgpr("commit: reply: full.length " + full.length
                            + ", data.length " + data.length);
                    if (data.indexOf("<rpc-error>") != -1)
                        success = false;
                    full.push(data);
                },
                oncomplete: function () {
                    $.dbgpr("rollback: complete");

                    if ($.isFunction(onComplete)) {
                        onComplete(success, full.join(""));
                    }
                },
                onclose: function (event, message) {
                    $.dbgpr("muxer: commit onclose");
                    if (full.length == 0) {
                        if ($.isFunction(onComplete)) {
                            onComplete(false, output);
                        }
                    }
                },
                onerror: function (message) {
                    $.dbgpr("muxer: commit onerror");
                    if ($.isFunction(onComplete)) {
                        onComplete(false, full.join(""));
                    }
                }
            });
        },


        runSlax: function (options) {
            if (!muxer) {
                openMuxer();
            }

            muxer.slax({
                script: options.script,
                view: options.view,
                type: options.type,
                args: options.args,
                oncomplete: function (data) {
                    if (options.success) {
                        options.success(data);
                    }
                },
                onerror: function (data) {
                    if (options.failure) {
                        options.failure(data)
                    }
                }
            });
        },

        /*
         * Looks up the available options under given command and builds a
         * form out of them along with data that each of the field may accept
         */
        buildAutoForm: function buildForm (target, command, view, buttons,
                                            title) {
            var nodeinfo = "";
            var muxer = $.clira.muxer();

            // Execute complete RPC and get available options
            muxer.rpc({
                div: view.$(),
                view: view,
                target: target,
                payload: '<complete>'
                        + command + ' ?'
                        + '</complete>',
                onreply: function (data) {
                    nodeinfo += data;
                },
                oncomplete: function () {
                    var $xmlDoc = $($.parseXML(nodeinfo)),
                        nokeyItem = null,
                        dataValues = {},
                        noname = 0,
                        fields = [],
                        mandatoryFields = false,
                        firstNokeyItem = null;

                    dataValues['_nokeyItem'] = [];

                    // Build list of fields along with their meta data to be
                    // used to build the form
                    $xmlDoc.find("expand-item").each(
                        function(n, item) {
                            var $this = $(this),
                                hidden = $this.find('hidden').length,
                                enter = $this.find('enter').length,
                                data = $this.find('data').length
                                type = $this.find('type').text(),
                                match = $this.find('match').text(),
                                matchMessage = $this.find('match-message').text(),
                                rangeMin = $this.find('range-min').text(),
                                rangeMax = $this.find('range-max').text(),
                                name = $this.find('name').text();

                            if (type === 'TYPE_COMMAND' || hidden > 0 || enter > 0
                                || name === '|') {
                                return;
                            }

                            if (!name) {
                                name = '_clira' + noname;
                                noname++;
                            }

                            var label = $.clira.formatLabel(name);

                            if ($this.find('flag-mandatory').length > 0) {
                                label += ' *';
                                mandatoryFields = true;
                            }

                            // Each field has an errors object that holds error
                            // messages of each type. Following are the
                            // different types of errors
                            // mandatory: Field is mandatory
                            // match: Regular expression match fail
                            // type: Type mismatch
                            // rangeMin: Value less than minimum allowed
                            // rangeMax: Value more than maximum allowed
                            if ($this.find('flag-mandatory').length) {
                                errors = {
                                    mandatory: name + ' is mandatory'
                                };
                                errorCount = 1;
                            } else {
                                errors = {};
                                errorCount = 0;
                            }

                            var item = {
                                name: name,
                                title: name,
                                fieldType: type,
                                hidden: hidden,
                                label: label,
                                help: $this.find('help').text(),
                                match: match,
                                matchMessage: matchMessage,
                                nokeyword: $this.find('flag-nokeyword').length,
                                mandatory: $this.find('flag-mandatory').length,
                                boolean: type == 'TYPE_TOGGLE',
                                type: type == 'TYPE_TOGGLE' ? 2 : 3,
                                errors: errors,
                                errorCount: errorCount
                            };

                            if (rangeMin) {
                                item['rangeMin'] = rangeMin;
                            }

                            if (rangeMax) {
                                item['rangeMax'] = rangeMax;
                            }

                            if ($this.find('data').length > 0) {
                                var dName = $this.find('data').text();
                                if (dName) {
                                    if (dataValuse[dName]) {
                                        dataValues[dName].push(name);
                                    } else {
                                        dataValues[dName] = [name];
                                    }
                                } else {
                                    dataValues['_nokeyItem'].push(name);
                                }
                            } else if (type === 'TYPE_CHOICE' 
                                        && $this.find('parent').length > 0) {
                                var parent = $this.find('parent').text();
                                if (dataValues[parent]) {
                                    dataValues[parent].push(name);
                                } else {
                                    dataValues[parent] = [name];
                                }
                            } else {
                                fields.unshift(item);
                                if (firstNokeyItem == null && item.nokeyword > 0) {
                                    firstNokeyItem = name;
                                }
                            }
                        }
                    );

                    // If we have mandatoryFields flag set, we display
                    // mandatory fields message at bottom of the form
                    if (mandatoryFields) {
                        view.get('controller').set('mandatoryFields', true);
                    }

                    // Assign data to fields
                    $.each(fields, function(i, v) {
                        if (v.name == firstNokeyItem) {
                            fields[i].select = true;
                            fields[i].data = dataValues['_nokeyItem'];
                        } else if (dataValues[v.name]) {
                            fields[i].select = true;
                            fields[i].data = dataValues[v.name];
                        } else {
                            // Expand one level further and get the completion
                            // data for this field
                            if (fields[i].type != 'TYPE_TOGGLE') {
                                // If we are building a config form, we should
                                // set config flag and read expansion data
                                // differently
                                if (command.indexOf('show configuration ') 
                                            == 0) {
                                    fields[i].config = true;
                                    fields[i].dataRPC =
                                        '<get-node-information><path>' 
                                        + command.slice(19, command
                                                            .lastIndexOf(' '))
                                                .replace(/ /g, '/') 
                                        + '/' + fields[i].name
                                        + '</path></get-node-information>';
                                } else {
                                    fields[i].dataRPC = '<complete>' + command
                                                      + ' ' + fields[i].name
                                                      + ' ?</complete>';
                                }
                                fields[i].completeTarget = target;
                                fields[i].select = true;
                                fields[i].data = [];
                            } else {
                                fields[i].select = false;
                            }
                        }
                    });

                    // Add missing field names
                    $.each(dataValues, function(k, v) {
                        if (k == '_nokeyItem') {
                            return;
                        }

                        for (var i = 0; i < fields.length; i++) {
                            if (fields[i].name == v.name) {
                                break;
                            }
                        }

                        if (i == fields.length) {
                            var item = {                            
                                name: k,
                                nokeyword: true,
                                help: k,
                                title: k,
                                label: $.clira.formatLabel(k),
                                radio: true,
                                data: v,
                                type: 0
                            };
                            fields.push(item);
                        }
                    });

                    //Sort fields so they can be rendered properly
                    fields.sort(function(a, b) {
                        if (a.mandatory == 1) {
                            return -1;
                        } else if (b.mandatory == 1) {
                            return 1;
                        } else {
                            if (a.boolean && !b.boolean) {
                                return 1;
                            } else if (!a.boolean && b.boolean) {
                                return -1;
                            } else if (a.radio) {
                                return 1;
                            } else if (b.radio) {
                                return -1;
                            } else if (a.label.length > 20 
                                && a.label.length > b.label.length) {
                                return 1;
                            }
                        }
                        return -1;
                    });

                    var prevType = -1;
                    // Group fields together
                    fields.forEach(function(field) {
                        if (prevType >= 0 && field.type != prevType) {
                            fields.splice(fields.indexOf(field), 0, 
                                            { spacer: true });
                        }
                        prevType = field.type;
                    });

                    $.clira.buildForm(view, fields, buttons, title);
                }
            });
        },

        /*
         * Builds a form with given fields, buttons and appends it to provided
         * view
         */
        buildForm: function buildForm (view, fields, buttons, title) {
            var v = view.get('parentView').container
                        .lookup('view:DynForm');

            // Add errors, errorCount to fields if the user has missed them
            for (var i = 0; i < fields.length; i++) {
                if (!fields[i].hasOwnProperty.errors) {
                    fields[i].errors = {};
                }
                if (!fields[i].hasOwnProperty.errorCount) {
                    fields[i].errorCount = 0;
                }
            }

            v.fields = fields;
            v.buttons = buttons;
            v.title = title;
            view.get('parentView').pushObject(v);
        },

        /*
         * Helper function to format the labels so they can be rendered
         * properly on form
         */
        formatLabel: function formatLabel (name) {
            var words = ['SNMP', 'ISSU', 'IPv4', 'IPv6', 'IP', 'TE', 'ISO', 
                        'CCC', 'MAC', 'TOS', 'TTL'];

            var label = name.replace(/-/g, ' ');
            label = label.charAt(0).toUpperCase() + label.slice(1);

            label = label.split(' ');
        
            var op = '';

            for (var i = 0; i < label.length; i++) {
                for (var j = 0; j < words.length; j++) {
                    if (label[i].toUpperCase() == words[j].toUpperCase()) {
                        break;
                    }
                }
                if (j == words.length) {
                    op += label[i];
                } else {
                    op += words[j];
                }

                if (i < label.length - 1) {
                    op += ' ';
                }
            }

            return op;
        },

        prefsChangeMuxer: function prefsChangeMuxer (value, initial, prev) {
            if (initial)
                return;

            if (muxer) {
                muxer.close();
                muxer = undefined;
            }
        },

        commandOutputTrimChanged: function commandOutputTrimChanged () {
            $.clira.commandOutputTrim(0);
        },

        commandOutputTrim: function commandOutputTrim (fresh_count) {
            var last = $output.get(0);
            if (!last)
                return;

            var keep = 0;
            for (var i = 0; last.children[i]; i++) {
                var $child = $(last.children[i]);
                if ($child.hasClass("keeper-active")) {
                    keep += 1;
                } else if (i < fresh_count) {
                    // do nothing
                } else if (i >= $.clira.prefs.output_remove_after + keep) {
                    divRemove($child);
                } else if (i >= $.clira.prefs.output_close_after + keep) {
                    if (!divIsHidden($child))
                        divHide($child);
                } else {
                    if (divIsHidden($child))
                        divUnhide($child);
                }
            }
        },

        targetListMarkUsed: function targetListMarkUsed (target, cname,
                                                        callback) {
            var $tset = $("#target-contents");
            var id = "target-is-" + cname;
            var $target = $("#" + id, $tset);

            if ($target && $target.length > 0) {
                $target.remove();
                $tset.prepend($target);

            } else {

                var content = "<div id='" + id + "' class='target " + id 
                    + " target-info rounded buttonish green'>"
                    + target
                    + "</div>";

                $target = jQuery(content);
                $tset.prepend($target);
                $(".target", $tset).each(function (index, target) {
                    var delta = $(target).position().top -
                        $(target).parent().position().top;
                    if ( delta > $.clira.prefs.max_target_position) {
                        $(target).remove();
                    }
                });     
            }

            $target.click(function (event) {
                if (tgtHistory) {
                    tgtHistory.close();
                    tgtHistory.select(target);
                }
                if (callback)
                    callback($target, target);
                $.clira.cmdHistory.focus();
            });

            $("#target-contents-none").css({ display: "none" });
        }
    });

    function promptForHostKey (view, data, onclick) {
        var hostKeyView = Clira.DynFormView.extend({
            title: "Host key for " + data.target,
            buttons: [{
                caption: "Accept",
                onclick: function() {
                    var onclick = this.get('parentView.parentView.onclick');
                    onclick("yes");
                    this.get('parentView.parentView').destroy();
                }
            },{
                caption: "Decline",
                onclick: function() {
                    var onclick = this.get('parentView.parentView.onclick');
                    onclick("no");
                    this.get('parentView.parentView').destroy();
                }
            }]
        }); 

        /*
         * Register hostKeyView, get an instance and push it to the container
         */
        view.get('parentView').container.register('view:hostKey', hostKeyView);
        var hkv = view.get('parentView').container.lookup('view:hostKey');
        hkv.message = data.prompt.split(/(?:\n)+/); 
        hkv.onclick = onclick;
        view.get('parentView').pushObject(hkv);
    }

    function promptForSecret (view, data, onclick, onclose) {
        var secretView = Clira.DynFormView.extend({
            title: data.target,
            buttons: [{
                caption: "Enter",
                onclick: function() {
                    var onclick = this.get('parentView.parentView.onclick');
                    onclick(this.get('controller.fieldValues').password);
                    this.$().context.enter = true;
                    this.get('parentView.parentView').destroy();
                }
            },{
                caption: "Cancel",
                onclick: function() {
                    if (!this.$().context.enter) {
                        this.get('parentView.parentView.onclose')();
                    }
                    this.get('parentView.parentView').destroy();
                }
            }]
        });
        var fields = [{
            name: "password",
            title: "",
            secret: true
        }];

        /*
         * Register secretView, get an instance and push it to the container
         */
        view.get('parentView').container.register('view:secret', secretView);
        var sv = view.get('parentView').container.lookup('view:secret');
        sv.fields = fields;
        sv.onclick = onclick;
        sv.onclose = onclose;
        sv.message = data.prompt.split(/(?:\n)+/);
        view.get('parentView').pushObject(sv);
    }

    function loadHttpReply (text, status, http, $this, $output) {
        $.dbgpr("loadHttpReply: ", "target:", target,
                "; status:", status, "; text:", text);
        $.dbgpr("http", http);

        if (status == "error") {
            $this.html("<div class='command-error'>"
                         + "An error occurred: "
                         + http.statusText
                         + "</div>");
        } else {
            var $xml = $($.parseXML(text));
            var $err = $xml.find("[nodeName='xnm:error']");
            if ($err[0])
                $this.html("<div class='command-error'>"
                             + "An error occurred: "
                           + htmlEscape($("message", $err).text())
                             + "</div>");
        }
        $output.slideDown($.clira.prefs.slide_speed);
    }

    function htmlEscape (val) {
        return val.replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;");
    }

    function divRemove ($wrapper) {
        $wrapper.slideUp($.clira.prefs.slide_speed, function () {
            $wrapper.remove();
        });
    }

    function divIsHidden ($wrapper) {
        return $(".icon-hide-section", $wrapper).hasClass("hidden");
    }

    function divHide ($wrapper) {
        $(".icon-unhide-section", $wrapper).removeClass("hidden");
        $(".icon-hide-section", $wrapper).addClass("hidden");
        $(".can-hide", $wrapper).slideUp($.clira.prefs.slide_speed);
    }

    function divUnhide ($wrapper) {
        $(".icon-unhide-section", $wrapper).addClass("hidden");
        $(".icon-hide-section", $wrapper).removeClass("hidden");
        $(".can-hide", $wrapper).slideDown($.clira.prefs.slide_speed);
    }

    function hideCommandForm (yform) {
        var $top = $(yform.form).parents("div.output-wrapper");
        var $bar = $("div.output-header", $top);

        if ($("button.icon-show-form", $bar).length == 0) {
            $bar.append("<button class='icon-show-form'/>"
                        + "<button class='icon-hide-form'/>");

            $(".icon-show-form", $bar).text("Show Form").button({
                text: false,
                icons: { primary: "ui-icon-circle-arrow-s" }
            }).click(function () {
                $(".icon-hide-form", $bar).removeClass("hidden");
                $(".icon-show-form", $bar).addClass("hidden");
                yform.form.slideDown($.clira.prefs.slide_speed);
            });

            $(".icon-hide-form", $bar).text("Hide Form").button({
                text: false,
                icons: { primary: "ui-icon-circle-arrow-n" }
            }).addClass("hidden").click(function () {
                $(".icon-show-form", $bar).removeClass("hidden");
                $(".icon-hide-form", $bar).addClass("hidden");
                yform.form.slideUp($.clira.prefs.slide_speed);
            });
        }

        $(".icon-show-form", $bar).removeClass("hidden");
        $(".icon-hide-form", $bar).addClass("hidden");
        yform.form.slideUp($.clira.prefs.slide_speed);
    }

    function runRpc (yform, $output, rpc, target) {
        $.dbgpr("runrpc:", rpc);
        
        $output.slideUp(0).slideDown($.clira.prefs.slide_speed);
        $output.load("/core/clira.slax", 
            {
                target: target, // target is optional
                rpc: rpc,       // rpc is in string form
                form: "false"   // don't want form in reply
            }, function (text, status, http) {
                loadHttpReply(text, status, http, $(this), $output);
            }
        );
    }
});
