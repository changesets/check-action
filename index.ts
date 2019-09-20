import * as core from "@actions/core";
import * as github from "@actions/github";
import getReleasePlan from "@changesets/get-release-plan";
import { IssuesListCommentsParams } from "@octokit/rest";

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

const getCommentId = (
  client: github.GitHub,
  params: IssuesListCommentsParams
) =>
  client.issues.listComments(params).then(comments => {
    const changesetBotComment = comments.data.find(comment =>
      comment.body.includes(changesetActionSignature)
    );
    return changesetBotComment ? changesetBotComment.id : null;
  });

const postOrUpdateComment = (
  commentId: number | null,
  client: github.GitHub,
  message: string
) => {
  if (commentId) {
    return client.issues.updateComment({
      comment_id: commentId,
      body: message,
      ...github.context.repo
    });
  }
  return client.issues.createComment({
    ...github.context.repo,
    issue_number: github.context.payload.pull_request!.number,
    body: message
  });
};
(async () => {
  // TODO: remove all console logs
  console.log("Starting up comment bot");
  let githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    core.setFailed("Please add the GITHUB_TOKEN to the changesets action");
    return;
  }

  const client = new github.GitHub(githubToken);

  console.log("about to get release plan");
  const releasePlan = await getReleasePlan(process.cwd(), true);
  console.log("acquired release plan");
  console.log("RP", releasePlan);

  const commentId = await getCommentId(client, {
    issue_number: github.context.payload.pull_request!.number,
    ...github.context.repo
  });

  // This is if there are no new changesets present
  if (releasePlan.changesets.length < 0) {
    let message = getAbsentMessage(github.context.sha);
    return postOrUpdateComment(commentId, client, message);
  }
  // This is if there are no new changesets present
  if (releasePlan.changesets.length > 0) {
    let message = getApproveMessage(github.context.sha);
    return postOrUpdateComment(commentId, client, message);
  }
})().catch(err => {
  console.error(err);
  core.setFailed(err.message);
});
