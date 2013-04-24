// js function used in the exdb webapp

/** enables a jQuery UI tooltip for all elements having an "imgurl" attribute. The tooltip shows
 *  the appropriate image.
 */
enableImgTooltips = function() {
    $(document).tooltip({
        items: "[imgurl]",
        content: function() {
            var element = $(this);
            return '<img class="tooltipimage" src="' + element.attr("imgurl") + '"/>';
        }
    });
};


ajaxReplaceContentPost = function(url, selector, data) {
    $.post(url, data, function(resp) {
        $(selector).empty().append(resp);
    });
};
              
function searchExercises() {
    tags = []
    $(".filterbutton").each( function(index, elem) {
        if ($(elem).is(":checked"))
            tags.push($(elem).attr("tag"));
    });
    $.post(searchUrl, {tags: JSON.stringify(tags)}, function(resp) {
        $(".exerciselist").empty().append(resp);
    });
};

function updateTagFilters() {
    $.get(tagfiltersUrl, function(resp) {
        $("#tagfilters").empty().append(resp);
        $(".filterbutton").button().click(function(event) {
            searchExercises();
        });
    });
};
