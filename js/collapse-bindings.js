(function () {
  function bindSimpleCollapse(buttonId, contentId) {
    const btn = document.getElementById(buttonId);
    const content = document.getElementById(contentId);
    if (!btn || !content) return;

    btn.addEventListener('click', function () {
      const isHidden = content.hasAttribute('hidden');
      if (isHidden) {
        content.removeAttribute('hidden');
        btn.setAttribute('aria-expanded', 'true');
      } else {
        content.setAttribute('hidden', '');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function initAllCollapses() {
    bindSimpleCollapse('backendZonesToggle', 'backendZonesCollapse');
    bindSimpleCollapse('summaryToggle', 'summaryCollapse');
    bindSimpleCollapse('alertsToggle', 'alertsCollapse');
    bindSimpleCollapse('chartToggle', 'chartCollapse');
    bindSimpleCollapse('aiRecsToggle', 'aiRecsCollapse');
    bindSimpleCollapse('simToggle', 'simCollapse');
    bindSimpleCollapse('assistantToggle', 'assistantCollapse');
    bindSimpleCollapse('rutasToggle', 'rutasCollapse');
    bindSimpleCollapse('voronoiResultsToggleMain', 'voronoiResultsCollapseMain');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllCollapses);
  } else {
    initAllCollapses();
  }
})();
