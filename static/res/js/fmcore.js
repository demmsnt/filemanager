
function FM(cfg) {
    this.cfg = cfg;
    this.login = undefined;
    this.password = undefined;
    this.clipboard=undefined;
    this.templates = {
        path: 'res/templates',
        login: 'login.html',
        ls: 'ls.html'
    };
    // =====================================================================================================================
    var waitingDialog = waitingDialog || (function($) {
        //http://bootsnipp.com/snippets/featured/quotwaiting-forquot-modal-dialog
        'use strict';

        // Creating modal dialog's DOM
        var $dialog = $(
            '<div class="modal fade" data-backdrop="static" data-keyboard="false" tabindex="-1" role="dialog" aria-hidden="true" style="padding-top:15%; overflow-y:visible;">' +
            '<div class="modal-dialog modal-m">' +
            '<div class="modal-content">' +
            '<div class="modal-header"><h3 style="margin:0;"></h3></div>' +
            '<div class="modal-body">' +
            '<div class="progress progress-striped active" style="margin-bottom:0;"><div class="progress-bar" style="width: 100%"></div></div>' +
            '</div>' +
            '</div></div></div>');

        return {
            /**
             * Opens our dialog
             * @param message Custom message
             * @param options Custom options:
             *                options.dialogSize - bootstrap postfix for dialog size, e.g. "sm", "m";
             *                options.progressType - bootstrap postfix for progress bar type, e.g. "success", "warning".
             */
            show: function(message, options) {
                // Assigning defaults
                if (typeof options === 'undefined') {
                    options = {};
                }
                if (typeof message === 'undefined') {
                    message = 'Loading';
                }
                var settings = $.extend({
                    dialogSize: 'm',
                    progressType: '',
                    onHide: null // This callback runs after the dialog was hidden
                }, options);

                // Configuring dialog
                $dialog.find('.modal-dialog').attr('class', 'modal-dialog').addClass('modal-' + settings.dialogSize);
                $dialog.find('.progress-bar').attr('class', 'progress-bar');
                if (settings.progressType) {
                    $dialog.find('.progress-bar').addClass('progress-bar-' + settings.progressType);
                }
                $dialog.find('h3').text(message);
                // Adding callbacks
                if (typeof settings.onHide === 'function') {
                    $dialog.off('hidden.bs.modal').on('hidden.bs.modal', function(e) {
                        settings.onHide.call($dialog);
                    });
                }
                // Opening dialog
                $dialog.modal();
            },
            /**
             * Closes dialog
             */
            hide: function() {
                $dialog.modal('hide');
            }
        };

    })(jQuery);
    // =====================================================================================================================

    this.sendCommand = function(command, callback, download) {
        var data = {
            login: this.login,
            password: this.password,
            command: command
        };
        var cfg = {
            url: this.cfg.api,
            data: { data: JSON.stringify(data) },
            type: 'POST',
            dataType: 'json',
            success: function(data) {
                if (data.status == 'error') {
                    console.debug('error', data.message);
                    waitingDialog.hide();
                    bootbox.alert("<pre>"+data.message+"</pre>", function() {
                    //    location.reload();
                    });
                } else {
                    callback(data, command);
                }
            }
        };
        if (download!=undefined) {
            $('#download-form').remove();
            var html='<form id="download-form" style="display:none" action="'+this.cfg.api+'" method="POST">';
            html = html+"<input type='text' name='data' value='"+JSON.stringify(data)+"'>";
            html = html+"</form>";
            $(html).appendTo('body');
            $('#download-form').submit();
        }
        else {
            var jqxhr = $.ajax(cfg).fail(function(a, b, c) {
                console.debug("Error", a, b, c);
                alert("Error");
            });
        }
    }
    this.setupLsHandlers = function () {
        var that = this;
        if (that.clipboard!== undefined ) {
            $('.btn-paste').removeAttr('disabled');
        }
        $('.btn-delete').bind('click', function (evt) {
            var fullname = $(evt.currentTarget).data('fullname');
            var name = $(evt.currentTarget).data('name');
            bootbox.confirm("Вы действительно хотите удалить "+name+"?",
                    function(result){
                        if (result) {
                            that.sendCommand({ 'command': 'rm', 'path': fullname },
                                function () {
                                    that.ls(that.path);
                                });
                        }
                    });

        });
        $('.btn-unpack').bind('click', function (evt) {
            var fullname = $(evt.currentTarget).data('fullname');
            var name = $(evt.currentTarget).data('name');
            waitingDialog.show("Подождите идет распаковка");
            that.sendCommand({ 'command': 'unpack', 'path': fullname },
                function () {
                    that.ls(that.path);
                    waitingDialog.hide();
                });
        });

        $('.btn-pack').bind('click', function (evt) {
            var fullname = $(evt.currentTarget).data('fullname');
            var name = $(evt.currentTarget).data('name');
            waitingDialog.show("Подождите идет упаковка");
            that.sendCommand({ 'command': 'pack', 'path': fullname },
                function () {
                    that.ls(that.path);
                    waitingDialog.hide();
                });
        });

        $('.btn-copy').bind('click', function (evt) {
            that.clipboard = {'cmd': 'cp', 'path': $(evt.currentTarget).data('fullname')};
            $('.btn-paste').removeAttr('disabled');
        });

        $('.btn-cut').bind('click', function (evt) {
            that.clipboard = {'cmd': 'mv', 'path': $(evt.currentTarget).data('fullname')};
            $('.btn-paste').removeAttr('disabled');
        });

        $('.btn-paste').bind('click', function (evt) {
            waitingDialog.show("Подождите идет вставка");
            that.sendCommand({ 'command': that.clipboard.cmd, 'path': [that.clipboard.path, that.path]},
                function () {
                    that.ls(that.path);
                    if (that.clipboard.cmd=='mv') {
                        $('.btn-paste').attr('disabled', '1');
                        that.clipboard = undefined;
                    }
                    waitingDialog.hide();
                });
        });

        $('.btn-mkdir').bind('click', function (evt) {
            bootbox.prompt("Введите имя каталога", function(result){
                        if (result!="") {
                            that.sendCommand({ 'command': 'mkdir', 'path': that.path+result },
                                function () {
                                    that.ls(that.path);
                                });
                        }
                    });
        });
        $('.btn-upload').bind('click', function (evt) {
            $('#upload-form').remove();
            var data = {
                login: that.login,
                password: that.password,
                command: {"command": "upload", path: that.path}
            };
            var html='<form id="upload-form" style="display:none" action="'+that.cfg.api+'" method="POST">';
            //html = html+"<input type='text' name='data' value='"+JSON.stringify(data)+"'>";
            html = html+"<input type='file' name='file'>";
            html = html+"</form>";
            $(html).appendTo('body');
            $('#upload-form input[name=file]').bind('change', function(evt){
                    waitingDialog.show("Подождите идет загрузка");
                    var files = evt.target.files;
                    var senddata = new FormData();
                    $.each(files, function(key, value)
                    {
                        senddata.append('file', value);
                    });
                    senddata.append('data', JSON.stringify(data));
                    $.ajax(
                        {
                          url: that.cfg.api,
                          data: senddata,
                          noencode: true,
                          method: 'POST',
                          cache: false,
                          dataType: 'json',
                          processData: false,
                          contentType: false,
                          success: function () {that.route();waitingDialog.hide()}
                          }
                  );

                //console.log('start upload');
                //$('#upload-form').submit();
            });
            $('#upload-form input[name=file]').click();
        });

    }
    this.ls = function(path) {
        var that = this;
        var apath = [];
        if (path != '/') {
            var bpath = path.split('/');
            var spath = '';
            $.each(bpath, function(idx, o) {
                if (idx+1 < bpath.length) {
                    if (o == "") {
                        apath.push({ name: '(root)', path: '/' });
                    } else {
                        spath = spath + '/' + o;
                        apath.push({ name: o, path: spath });
                    }
                }
            });
        }

        this.sendCommand({ 'command': 'ls', 'path': path },
            function(data) {
                var html = nunjucks.render(that.templates.ls, { 'data': data.result, path: apath });
                $('#view').html(html);
                that.path = path;
                that.setupLsHandlers();
            });
    }

    this.download = function(path) {
        console.log('download', path);
        this.sendCommand({ 'command': 'download', 'path': path },
                         function(data) {
                            console.log('data=', data);
                         },
                         true);
    }

    this.login = function() {
        var html = nunjucks.render(this.templates.login, {});
        var that = this;
        $('#view').html(html);
        $('#btn-login').bind('click', function(evt) {
            var login = $('#login').val();
            var password = $('#password').val();
            that.sendCommand({
                    command: 'login',
                    login: login,
                    password: md5(password)
                },
                function(data) {
                    that.login = login;
                    that.password = md5(password);
                    if (window.location.hash == '#/') {
                        that.route();
                    } else {
                        window.location.hash = '#/';
                    }
                }
            );
        });
    }

    this.route = function() {
        if (this.login == undefined || this.password == undefined) {
            this.login();
            return;
        }
        var path = '/';
        if (window.location.hash.length > 0) {
            var hash = window.location.hash.replace('#', '');
            path = hash;
        }
        var arr = path.split("/");
        if (arr[0] == "") {
            this.ls(path);
            return;
        }
        if (arr[0] == "download") {
            this.download(path.replace('download', ''));
            return;
        }




    }

    this.init = function() {
        var env = nunjucks.configure(this.templates.path);
        //env.addFilter('money', asMoney);
        var that = this;
        $(window).bind('hashchange', function() { that.route(); });
        this.route();
    }
    this.init();
}

function loadFm(cfg) {
    var fm = FM(cfg);

}
