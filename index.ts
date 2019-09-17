import * as core from "@actions/core";
import * as github from "@actions/github";
import { IssuesListCommentsParams, PullsListFilesParams } from "@octokit/rest";
// @ts-ignore
import humanId from "human-id";

const changesetActionSignature = `<!-- changeset-check-action-signature -->`;

let addChangesetUrl = `${
  github.context.payload.pull_request!.head.repo.html_url
}/new/${
  github.context.payload.pull_request!.head.ref
}?filename=.changeset/${humanId({
  separator: "-",
  capitalize: false
})}.md`;

function getAbsentMessage(commitSha: string) {
  return `###  💥  No Changeset
Latest commit: ${commitSha}

Merging this PR will not cause any packages to be released. If these changes should not cause updates to packages in this repo, this is fine 🙂

**If these changes should be published to npm, you need to add a changeset.**

[Click here to learn what changesets are, and how to add one](https://github.com/Noviny/changesets/blob/master/docs/adding-a-changeset.md).

[Click here if you're a maintainer who wants to add a changeset to this PR](${addChangesetUrl})
${changesetActionSignature}`;
}
function getApproveMessage(commitSha: string) {
  return `###  🦋  Changeset is good to go
Latest commit: ${commitSha}

**We got this.**

Not sure what this means? [Click here to learn what changesets are](https://github.com/Noviny/changesets/blob/master/docs/adding-a-changeset.md).
${changesetActionSignature}`;
}

const getCommentId = (
  octokit: github.GitHub,
  params: IssuesListCommentsParams
) =>
  octokit.issues.listComments(params).then(comments => {
    const changesetBotComment = comments.data.find(comment =>
      comment.body.includes(changesetActionSignature)
    );
    return changesetBotComment ? changesetBotComment.id : null;
  });

const getHasChangeset = (
  octokit: github.GitHub,
  params: PullsListFilesParams
) =>
  octokit.pulls.listFiles(params).then(files => {
    const changesetFiles = files.data.filter(
      file => file.filename.startsWith(".changeset") && file.status === "added"
    );
    return changesetFiles.length > 0;
  });

(async () => {
  let githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    core.setFailed("Please add the GITHUB_TOKEN to the changesets action");
    return;
  }
  let repo = `${github.context.repo.owner}/${github.context.repo.repo}`;

  const octokit = new github.GitHub(githubToken);
  console.log(JSON.stringify(github.context.payload, null, 2));
  const [commentId, hasChangeset] = await Promise.all([
    getCommentId(octokit, {
      issue_number: github.context.payload.pull_request!.number,
      ...github.context.repo
    }),
    getHasChangeset(octokit, {
      pull_number: github.context.payload.pull_request!.number,
      ...github.context.repo
    })
  ]);

  let message = hasChangeset
    ? getApproveMessage(github.context.sha)
    : getAbsentMessage(github.context.sha);

  if (commentId) {
    return octokit.issues.updateComment({
      comment_id: commentId,
      body: message,
      ...github.context.repo
    });
  }
  return octokit.issues.createComment({
    ...github.context.repo,
    issue_number: github.context.payload.pull_request!.number,
    body: message
  });
})().catch(err => {
  console.error(err);
  core.setFailed(err.message);
});
