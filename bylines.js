(() => {
  const profiles = new Map([
    ["Eunkyo Seo", "eunkyo-seo"],
    ["Sunlae Tak", "sunlae-tak"],
    ["Ji-Hye Yeo", "ji-hye-yeo"],
    ["Emmanuel C. Dioha", "emmanuel-dioha"],
    ["Junnyeong Han", "junnyeong-han"],
    ["Gyuyeon Choi", "gyuyeon-choi"],
    ["Bora Lee", "bora-lee"],
    ["Yunju Park", "yunju-park"],
    ["Seongjun Bae", "seongjun-bae"],
    ["Youngkyo Kim", "youngkyo-kim"],
    ["Sujeong Kang", "sujeong-kang"]
  ]);

  for (const byline of document.querySelectorAll("[data-byline]")) {
    const names = (byline.dataset.byline || byline.textContent).split(",").map(name => name.trim()).filter(Boolean);
    const credits = document.createDocumentFragment();
    names.forEach((name, index) => {
      const member = profiles.get(name);
      const credit = document.createElement(member ? "a" : "span");
      credit.className = "author-credit";
      if (member) {
        credit.href = 'people.html#' + member;
        credit.setAttribute('aria-label', name + ', lab profile');
      }
      credit.append(name);
      if (index < names.length - 1) credit.append(",");
      credits.append(credit, " ");
    });
    byline.replaceChildren(credits);
  }
})();
