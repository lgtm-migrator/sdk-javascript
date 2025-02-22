const {
    ProfileSearchResult,
  } = require("../../../src/core/searchResult/Profile"),
  { Profile } = require("../../../src/core/security/Profile"),
  sinon = require("sinon"),
  should = require("should");

describe("ProfileSearchResult", () => {
  const options = { opt: "in" };

  let kuzzle, request, result, searchResult;

  beforeEach(() => {
    kuzzle = {
      query: sinon.stub().resolves(),
    };

    request = {
      body: { query: { foo: "bar" } },
      controller: "security",
      action: "searchProfiles",
    };
  });

  describe("constructor", () => {
    it("should create a ProfileSearchResult instance with good properties", () => {
      result = {
        hits: [
          {
            _id: "profile1",
            _version: 1,
            _source: { policies: ["foo", "bar"] },
          },
          {
            _id: "profile2",
            _version: 3,
            _source: { policies: ["foo", "baz"] },
          },
        ],
        total: 3,
      };

      searchResult = new ProfileSearchResult(kuzzle, request, options, result);

      should(searchResult._request).be.equal(request);
      should(searchResult._options).be.equal(options);
      should(searchResult._result).be.equal(result);

      should(searchResult.fetched).be.equal(2);
      should(searchResult.total).be.equal(3);

      should(searchResult._controller).be.equal("security");
      should(searchResult._searchAction).be.equal("searchProfiles");
      should(searchResult._scrollAction).be.equal("scrollProfiles");

      should(searchResult.hits).be.an.Array();
      should(searchResult.hits.length).be.equal(2);

      should(searchResult.hits[0]).be.an.instanceOf(Profile);
      should(searchResult.hits[0]._id).be.eql("profile1");
      should(searchResult.hits[0].policies).be.eql(["foo", "bar"]);

      should(searchResult.hits[1]).be.an.instanceOf(Profile);
      should(searchResult.hits[1]._id).be.eql("profile2");
      should(searchResult.hits[1].policies).be.eql(["foo", "baz"]);
    });
  });

  describe("next", () => {
    it("should resolve null without calling kuzzle query if all results are already fetched", () => {
      result = {
        scrollId: "scroll-id",
        hits: [
          {
            _id: "profile1",
            _version: 1,
            _source: { policies: ["foo", "bar"] },
          },
          {
            _id: "profile2",
            _version: 3,
            _source: { policies: ["foo", "baz"] },
          },
        ],
        total: 2,
      };

      searchResult = new ProfileSearchResult(kuzzle, request, options, result);

      return searchResult.next().then((res) => {
        should(kuzzle.query).not.be.called();
        should(res).be.Null();
      });
    });

    it("should reject with an error if neither scroll, nor size/sort, nor size/from parameters are set", () => {
      result = {
        scrollId: "scroll-id",
        hits: [
          {
            _id: "profile1",
            _version: 1,
            _source: { policies: ["foo", "bar"] },
          },
          {
            _id: "profile2",
            _version: 3,
            _source: { policies: ["foo", "baz"] },
          },
        ],
        total: 30,
      };

      searchResult = new ProfileSearchResult(kuzzle, request, options, result);

      return should(searchResult.next()).be.rejectedWith(
        "Unable to retrieve next results from search: missing scrollId, from/sort, or from/size params"
      );
    });

    describe("#with scroll option", () => {
      const nextResponse = {
        scrollId: "scroll-id",
        hits: [
          { _id: "profile3", _version: 1, _source: { policies: ["baz"] } },
          {
            _id: "profile4",
            _version: 3,
            _source: { policies: ["foo", "bar", "baz"] },
          },
        ],
        total: 30,
      };

      beforeEach(() => {
        request.scroll = "10s";

        result = {
          scrollId: "scroll-id",
          hits: [
            {
              _id: "profile1",
              _version: 1,
              _source: { policies: ["foo", "bar"] },
            },
            {
              _id: "profile2",
              _version: 3,
              _source: { policies: ["foo", "baz"] },
            },
          ],
          total: 30,
        };
        searchResult = new ProfileSearchResult(
          kuzzle,
          request,
          options,
          result
        );

        kuzzle.query.resolves({ result: nextResponse });
      });

      it("should call security/scrollProfiles action with scrollId parameter and resolve to a new ProfileSearchResult", () => {
        return searchResult.next().then((nextSearchResult) => {
          should(kuzzle.query).be.calledOnce().be.calledWith({
            controller: "security",
            action: "scrollProfiles",
            scroll: "10s",
            scrollId: "scroll-id",
          });
          should(nextSearchResult).not.be.equal(searchResult);
          should(nextSearchResult).be.instanceOf(ProfileSearchResult);
        });
      });

      it('should set the result and increment the "fetched" property', () => {
        should(searchResult.fetched).be.equal(2);
        should(searchResult._result).be.equal(result);
        return searchResult.next().then((nextSearchResult) => {
          should(nextSearchResult.fetched).be.equal(4);
          should(nextSearchResult._result).be.equal(nextResponse);

          should(nextSearchResult.hits).be.an.Array();
          should(nextSearchResult.hits.length).be.equal(2);

          should(nextSearchResult.hits[0]).be.an.instanceOf(Profile);
          should(nextSearchResult.hits[0]._id).be.eql("profile3");
          should(nextSearchResult.hits[0].policies).be.eql(["baz"]);

          should(nextSearchResult.hits[1]).be.an.instanceOf(Profile);
          should(nextSearchResult.hits[1]._id).be.eql("profile4");
          should(nextSearchResult.hits[1].policies).be.eql([
            "foo",
            "bar",
            "baz",
          ]);
        });
      });
    });

    describe("#with size and sort option", () => {
      const nextResponse = {
        hits: [
          { _id: "profile3", _version: 1, _source: { policies: ["baz"] } },
          {
            _id: "profile4",
            _version: 3,
            _source: { policies: ["foo", "bar", "baz"] },
          },
        ],
        total: 30,
      };

      beforeEach(() => {
        request.size = 2;
        request.body.sort = ["foo", { bar: "asc" }];

        result = {
          hits: [
            {
              _id: "profile1",
              _version: 1,
              _source: {
                policies: ["foo", "bar"],
                foo: "bar",
                bar: 1234,
              },
            },
            {
              _id: "profile2",
              _version: 3,
              _source: {
                policies: ["foo", "baz"],
                foo: "baz",
                bar: 3456,
              },
            },
          ],
          total: 30,
        };
        searchResult = new ProfileSearchResult(
          kuzzle,
          request,
          options,
          result
        );

        kuzzle.query.resolves({ result: nextResponse });
      });

      it("should call security/searchProfiles action with search_after \
          parameter and resolve to a new ProfileSearchResult", () => {
        return searchResult.next().then((nextSearchResult) => {
          should(kuzzle.query)
            .be.calledOnce()
            .be.calledWith(
              {
                body: {
                  sort: ["foo", { bar: "asc" }],
                  search_after: ["baz", 3456],
                  query: { foo: "bar" },
                },
                controller: "security",
                action: "searchProfiles",
                size: 2,
              },
              options
            );
          should(nextSearchResult).not.be.equal(searchResult);
          should(nextSearchResult).be.instanceOf(ProfileSearchResult);
        });
      });

      it('should set the result and increment the "fetched" property', () => {
        should(searchResult.fetched).be.equal(2);
        should(searchResult._result).be.equal(result);
        return searchResult.next().then((nextSearchResult) => {
          should(nextSearchResult.fetched).be.equal(4);
          should(nextSearchResult._result).be.equal(nextResponse);

          should(nextSearchResult.hits).be.an.Array();
          should(nextSearchResult.hits.length).be.equal(2);

          should(nextSearchResult.hits[0]).be.an.instanceOf(Profile);
          should(nextSearchResult.hits[0]._id).be.eql("profile3");
          should(nextSearchResult.hits[0].policies).be.eql(["baz"]);

          should(nextSearchResult.hits[1]).be.an.instanceOf(Profile);
          should(nextSearchResult.hits[1]._id).be.eql("profile4");
          should(nextSearchResult.hits[1].policies).be.eql([
            "foo",
            "bar",
            "baz",
          ]);
        });
      });
    });

    describe("#with from and size option", () => {
      const nextResponse = {
        hits: [
          { _id: "profile3", _version: 1, _source: { policies: ["baz"] } },
          {
            _id: "profile4",
            _version: 3,
            _source: { policies: ["foo", "bar", "baz"] },
          },
        ],
        total: 30,
      };

      beforeEach(() => {
        request.size = 2;
        request.from = 2;

        result = {
          hits: [
            {
              _id: "profile1",
              _version: 1,
              _source: { policies: ["foo", "bar"] },
            },
            {
              _id: "profile2",
              _version: 3,
              _source: { policies: ["foo", "baz"] },
            },
          ],
          total: 30,
        };
        searchResult = new ProfileSearchResult(
          kuzzle,
          request,
          options,
          result
        );

        kuzzle.query.resolves({ result: nextResponse });
      });

      it("should resolve null without calling kuzzle query if from parameter is greater than the search count", () => {
        request.from = 30;

        return searchResult.next().then((res) => {
          should(kuzzle.query).not.be.called();
          should(res).be.Null();
        });
      });

      it("should call security/searchProfiles action with from/size parameters and resolve to a new ProfileSearchResult", () => {
        return searchResult.next().then((nextSearchResult) => {
          should(kuzzle.query)
            .be.calledOnce()
            .be.calledWith(
              {
                body: { query: { foo: "bar" } },
                controller: "security",
                action: "searchProfiles",
                size: 2,
                from: 2,
              },
              options
            );
          should(nextSearchResult).not.be.equal(searchResult);
          should(nextSearchResult).be.instanceOf(ProfileSearchResult);
        });
      });

      it('should set the result and increment the "fetched" property', () => {
        should(searchResult.fetched).be.equal(2);
        should(searchResult._result).be.equal(result);
        return searchResult.next().then((nextSearchResult) => {
          should(nextSearchResult.fetched).be.equal(4);
          should(nextSearchResult._result).be.equal(nextResponse);

          should(nextSearchResult.hits).be.an.Array();
          should(nextSearchResult.hits.length).be.equal(2);

          should(nextSearchResult.hits[0]).be.an.instanceOf(Profile);
          should(nextSearchResult.hits[0]._id).be.eql("profile3");
          should(nextSearchResult.hits[0].policies).be.eql(["baz"]);

          should(nextSearchResult.hits[1]).be.an.instanceOf(Profile);
          should(nextSearchResult.hits[1]._id).be.eql("profile4");
          should(nextSearchResult.hits[1].policies).be.eql([
            "foo",
            "bar",
            "baz",
          ]);
        });
      });
    });
  });
});
