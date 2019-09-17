import * as core from "@actions/core";
import * as github from "@actions/github";
import { IssuesListCommentsParams, PullsListFilesParams } from "@octokit/rest";

const changesetActionSignature = `<!-- changeset-check-action-signature -->`;

function getAbsentMessage(commitSha: string) {
  return `###  💥  No Changeset
Latest commit: ${commitSha}

Merging this PR will not cause any packages to be released. If these changes should not cause updates to packages in this repo, this is fine 🙂

**If these changes should be published to npm, you need to add a changeset.**

[Click here to learn what changesets are, and how to add one](https://github.com/Noviny/changesets/blob/master/docs/adding-a-changeset.md).
${changesetActionSignature}`;
}
function getApproveMessage(commitSha: string) {
  return `###  🦋  Changeset is good to go
Latest commit: ${commitSha}

**We got this.**

Not sure what this means? [Click here to learn what changesets are](https://github.com/Noviny/changesets/blob/master/docs/adding-a-changeset.md).
${changesetActionSignature}`;
}

function getRemovedMessage(commitSha: string) {
  return `###  🦋  It looks like you're doing a release 📎
Latest commit: ${commitSha}

(this PR removes changesets - if this is unintentional, you probably shouldn't merge this)

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

const getChangesetPresence = (
  octokit: github.GitHub,
  params: PullsListFilesParams
) =>
  octokit.pulls.listFiles(params).then(files => {
    let hasRemoved = files.data.find(
      file =>
        file.filename.startsWith(".changeset") && file.status === "removed"
    );

    if (hasRemoved) {
      return "removed";
    }
    let hasAdded = files.data.find(
      file => file.filename.startsWith(".changeset") && file.status === "added"
    );

    if (hasAdded) {
      return "added";
    }

    return "none";
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
  const [commentId, changesetPresence] = await Promise.all([
    getCommentId(octokit, {
      issue_number: github.context.payload.pull_request!.number,
      ...github.context.repo
    }),

    getChangesetPresence(octokit, {
      pull_number: github.context.payload.pull_request!.number,
      ...github.context.repo
    })
  ]);

  let message = "";

  switch (changesetPresence) {
    case "added": {
      message = getApproveMessage(github.context.sha);
    }
    case "removed": {
      message = getRemovedMessage(github.context.sha);
    }
    case "none": {
      message = getAbsentMessage(github.context.sha);
    }
  }

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
