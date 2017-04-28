/* globals moment */     // moment.js

/* globals Alerts, Autocomplete, Filters, Summary, Templates, Unsee */

/* exported UI */
var UI = (function() {

    // when user click on any alert label modal popup with a list of possible
    // filter will show, this function is used to setup that modal
    var setupModal = function() {
        $("#labelModal").on("show.bs.modal", function(event) {
            Unsee.Pause();
            var modal = $(this);
            var label = $(event.relatedTarget);
            var label_key = label.data("label-key");
            var label_val = label.data("label-val");
            var attrs = Alerts.GetLabelAttrs(label_key, label_val);
            var counter = Summary.Get(label_key, label_val);
            modal.find(".modal-title").html(
                Templates.Render("modalTitle", {
                  attrs: attrs,
                  counter: counter
                })
            );
            var hints = Autocomplete.GenerateHints(label_key, label_val);
            modal.find(".modal-body").html(
              Templates.Render("modalBody", {hints: hints})
            );
            $(".modal-table").on("click", ".modal-button-filter", function(elem) {
                var filter = $(elem.target).data("filter-append-value");
                $("#labelModal").modal("hide");
                Filters.AddFilter(filter);
            });
        });
        $("#labelModal").on("hidden.bs.modal", function() {
            var modal = $(this);
            modal.find(".modal-title").children().remove();
            modal.find(".modal-body").children().remove();
            Unsee.WaitForNextReload();
        });
    };

    // each alert group have a link generated for it, but we hide it until
    // user hovers over that group so it doesn"t trash the UI
    var setupGroupLinkHover = function(elem) {
        $(elem).on("mouseenter", function() {
            $(this).find(".alert-group-link > a").finish().animate({
                opacity: 100
            }, 200);
        });
        $(elem).on("mouseleave", function() {
            $(this).find(".alert-group-link > a").finish().animate({
                opacity: 0
            }, 200);
        });
    };

    // find all elements inside alert group panel that will use tooltips
    // and setup those
    var setupGroupTooltips = function(groupElem) {
        $.each(groupElem.find("[data-toggle=tooltip]"), function(i, elem) {
            $(elem).tooltip({
                animation: false, // slows down tooltip removal
                delay: {
                    show: 500,
                    hide: 0
                },
                title: $(elem).attr("title") || $(elem).data("ts-title"),
                trigger: "hover"
            });
        });
    };

    var setupAlertGroupUI = function(elem) {
        setupGroupLinkHover(elem);
        setupGroupTooltips(elem);
    };

    var init = function() {
        setupModal();
        setupSilenceForm();
    };

    var silenceFormData = function() {
        var values = $("#newSilenceForm").serializeArray();
        var payload = {
          matchers: [],
          startsAt: "",
          endsAt: "",
          createdBy: "",
          comment: ""
        };
        $.each(values, function(i, elem){
           switch (elem.name) {
             case "comment": case "createdBy":
               payload[elem.name] = elem.value;
               break;
           }
        });
        if ($("#startsAt").data('DateTimePicker')) {
          payload.startsAt = $("#startsAt").data('DateTimePicker').date();
        }
        if ($("#endsAt").data('DateTimePicker')) {
          payload.endsAt = $("#endsAt").data('DateTimePicker').date();
        }
        $.each($("#newSilenceForm .selectpicker"), function(i, elem) {
            var label_key = $(elem).data('label-key');
            var values = $(elem).selectpicker('val');
            if (values && values.length > 0) {
              var pval;
              var isRegex = false;
              if (values.length > 1) {
                  pval = "^(?:" + values.join("|") + ")$";
                  isRegex = true;
              } else {
                  pval = values[0];
              }
              payload.matchers.push({
                  name: label_key,
                  value: pval,
                  isRegex: isRegex
              });
            }
        });
        return payload;
    };

    var silenceFormCalculateDuration = function() {
      // skip if datetimepicker isn't ready yet
      if (!$("#startsAt").data('DateTimePicker') || !$("#endsAt").data('DateTimePicker')) return false;

      var startsAt = $("#startsAt").data('DateTimePicker').date();
      var endsAt = $("#endsAt").data('DateTimePicker').date();

      var totalDays = (endsAt.diff(startsAt, 'days'));
      var totalHours = (endsAt.diff(startsAt, 'hours')) % 24;
      var totalMinutes = endsAt.diff(startsAt, 'minutes') % 60;
      $("#silence-duration-days").html(totalDays);
      $("#silence-duration-hours").html(totalHours);
      $("#silence-duration-minutes").html(totalMinutes);

      var startsAtDesc = moment().to(startsAt);
      startsAtDesc = startsAtDesc.replace("in a few seconds", "now");
      startsAtDesc = startsAtDesc.replace("a few seconds ago", "now");
      $("#silence-start-description").html(startsAtDesc);

      var endsAtDesc = moment().to(endsAt);
      endsAtDesc = endsAtDesc.replace("in a few seconds", "now");
      endsAtDesc = endsAtDesc.replace("a few seconds ago", "now");
      $("#silence-end-description").html(endsAtDesc);
    };

    var silenceFormJSONRender = function() {
      var d = "curl " + $("#silenceModal").data("silence-api") +
        "\n    -X POST --data " +
        JSON.stringify(silenceFormData(), undefined, 2);
      $("#silenceJSONBlob").html(d);
    };

    var silenceFormUpdateDuration = function(event) {
      // skip if datetimepicker isn't ready yet
      if (!$("#startsAt").data('DateTimePicker') || !$("#endsAt").data('DateTimePicker')) return false;

      var startsAt = $("#startsAt").data('DateTimePicker').date();
      var endsAt = $("#endsAt").data('DateTimePicker').date();
      var endsAtMinDate = $("#endsAt").data('DateTimePicker').minDate();
      var action = $(event.target).data("duration-action");
      var unit = $(event.target).data("duration-unit");
      var step = parseInt($(event.target).data("duration-step"));

      // re-calculate step for low values
      // if we have 5 minute step and current duration is 1 minute than clicking
      // on the increment should give us 5 minute, not 6 minute duration
      var totalValue = (endsAt.diff(startsAt, unit));
      switch (unit) {
        case "hours":
          totalValue = totalValue % 24;
          break;
        case "minutes":
          totalValue = totalValue % 60;
          break;
      }

      if (action == "increment") {
        // if step is 5 minute and current value is 3 than set 5 minutes, not 8
        if (step > 1 && totalValue < step) {
          step = step - totalValue;
        }
        endsAt.add(step, unit);
      } else {
        // if step is 5 minute and current value is 3 than set 0 minutes
        if (totalValue > 0 && step > 1 && totalValue < step) {
          step = totalValue;
        }
        endsAt.subtract(step, unit);
        if (endsAt < endsAtMinDate) {
          // if decrement would result in a timestamp lower than allowed minimum
          // then just reset it to the minimum
          endsAt = endsAtMinDate;
        }
      }
      $("#endsAt").data('DateTimePicker').date(endsAt);
      silenceFormCalculateDuration();
    };

    // modal form for creating new silences
    var setupSilenceForm = function() {
        var modal = $("#silenceModal");
        modal.on("show.bs.modal", function(event) {
            Unsee.Pause();
            modal.find(".modal-body").html(
                Templates.Render("silenceFormLoading", {})
            );
            var elem = $(event.relatedTarget);
            var elemLabels = {};
            $.each(elem.data("labels").split(","), function(i, l) {
                elemLabels[l.split("=")[0]] = l.split("=")[1];
            });
            $.ajax({
              url: 'alerts.json?q=alertname=' + elem.data('alertname'),
              error: function(xhr, textStatus, errorThrown) {
                  var err = xhr.responseText || errorThrown || textStatus;
                  modal.find(".modal-body").html(
                    Templates.Render("silenceFormFatal", {error: err})
                  );
              },
              success: function(data) {
                  var modal = $("#silenceModal");
                  var labels = {};
                  $.each(data.groups, function(i, group) {
                      $.each(group.alerts, function(j, alert) {
                          $.each(alert.labels, function(label_key, label_val) {
                              if (labels[label_key] === undefined) {
                                  labels[label_key] = {};
                              }
                              if (labels[label_key][label_val] === undefined) {
                                  labels[label_key][label_val] = {
                                      key: label_key,
                                      value: label_val,
                                      attrs: Alerts.GetLabelAttrs(label_key, label_val),
                                      selected: elemLabels[label_key] == label_val
                                  };
                              }
                          });
                      });
                  });
                  modal.find(".modal-body").html(
                    Templates.Render("silenceForm", {labels: labels})
                  );
                  $.each($(".selectpicker"), function(i, elem) {
                    $(elem).selectpicker({
                        iconBase: 'fa',
                        tickIcon: 'fa-check',
                        width: 'fit',
                        selectAllText: '<i class="fa fa-check-square-o"></i>',
                        deselectAllText: '<i class="fa fa-square-o"></i>',
                        noneSelectedText: '<span class="label label-list label-default">' + $(this).data('label-key') + ": </span>",
                        multipleSeparator: ' ',
                        selectedTextFormat: 'count > 1',
                        countSelectedText: function (numSelected) {
                          return '<span class="label label-list label-warning">' +
                            $(elem).data('label-key') + ": " + numSelected + " values selected</span>";
                        }
                    });
                  });
                  $('.datetime-picker').datetimepicker({
                    format: "YYYY-MM-DD HH:mm",
                    icons: {
                        time: 'fa fa-clock-o',
                        date: 'fa fa-calendar',
                        up: 'fa fa-chevron-up',
                        down: 'fa fa-chevron-down',
                        previous: 'fa fa-chevron-left',
                        next: 'fa fa-chevron-right',
                        today: 'fa fa-asterisk',
                        clear: 'fa fa-undo',
                        close: 'fa fa-close'
                    },
                    minDate: moment(),
                    sideBySide: true,
                    inline: true
                  });
                  setupGroupTooltips($("#newSilenceForm"));
                  $('.select-label-badge').on('click', function() {
                    var select = $(this).parent().parent().find('select');
                    if (select.selectpicker('val')) {
                      // if there's anything selected deselect all
                      select.selectpicker('deselectAll');
                    } else {
                      // else select all
                      select.selectpicker('selectAll');
                    }
                  });
                  // set endsAt minDate to now + 1 minute
                  $("#endsAt").data('DateTimePicker').minDate(moment().add(1, 'minute'));
                  // set endsAt time to +1 hour
                  $("#endsAt").data('DateTimePicker').date(moment().add(1, 'hours'));
                  // whenever startsAt changes set it as the minDate for endsAt
                  // we can't have endsAt < startsAt
                  $("#newSilenceForm").on("dp.change", "#startsAt", function(){
                    if (!$("#startsAt").data('DateTimePicker')) return false;
                    var startsAt = $("#startsAt").data('DateTimePicker').date();
                    // endsAt needs to be at least 1 minute after startsAt
                    startsAt.add(1, "minute");
                    $("#endsAt").data('DateTimePicker').minDate(startsAt);
                  });
                  $("#newSilenceForm").on("click", "a.silence-duration-btn", silenceFormUpdateDuration);
                  $("#newSilenceForm").on('show.bs.collapse, dp.change', function () {
                      silenceFormJSONRender();
                      silenceFormCalculateDuration();
                  });
                  $("#newSilenceForm").on('change', function () {
                      silenceFormJSONRender();
                  });
                  $("#newSilenceForm").submit(function(event) {
                      var payload = silenceFormData();
                      if (payload.matchers.length === 0) {
                          var errContent = Templates.Render("silenceFormError", {error: "Select at least on label"});
                          $("#newSilenceAlert").html(errContent).removeClass("hidden");
                          return false;
                      }

                      var url = modal.data("silence-api");
                      $.ajax({
                        type: "POST",
                        url: url,
                        data: JSON.stringify(payload),
                        error: function(xhr, textStatus, errorThrown) {
                            // default to whatever error text we can get
                            var err = xhr.responseText || errorThrown || textStatus;
                            if (xhr.responseText) {
                                // if we have a reponse text try to decode it as JSON
                                // it should be error from Alertmanager (it we were able to connect)
                                try {
                                  var j = JSON.parse(xhr.responseText);
                                  if (j.error !== undefined) {
                                    err = j.error;
                                  }
                                } catch (error) {
                                  // can't parse json, do nothing
                                }
                            }

                            var errContent = Templates.Render("silenceFormError", {error: err});
                            $("#newSilenceAlert").html(errContent).removeClass("hidden");
                        },
                        success: function(data) {
                            if (data.status == "success") {
                              $("#newSilenceAlert").addClass("hidden");
                              $('#newSilenceForm').html(Templates.Render("silenceFormSuccess", {
                                  silenceID: data.data.silenceId
                              }));
                            } else {
                              var err = "Invalid response from Alertmanager API: " + JSON.stringify(data);
                              var errContent = Templates.Render("silenceFormError", {error: err});
                              $("#newSilenceAlert").html(errContent).removeClass("hidden");
                            }
                        },
                        dataType: "json"
                      });

                      event.preventDefault();
                  });
                  silenceFormCalculateDuration();
                }
            });

        });
        modal.on("hidden.bs.modal", function() {
            var modal = $(this);
            modal.find(".modal-body").children().remove();
            Unsee.WaitForNextReload();
        });
    };

    return {
        Init: init,
        SetupAlertGroupUI: setupAlertGroupUI
    };

})();
