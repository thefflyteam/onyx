import pytest

from onyx.context.search.enums import RecencyBiasSetting
from onyx.db.engine.sql_engine import get_session_with_current_tenant
from onyx.db.llm import can_user_access_llm_provider
from onyx.db.llm import is_llm_provider_effectively_public
from onyx.db.models import LLMProvider as LLMProviderModel
from onyx.db.models import LLMProvider__Persona
from onyx.db.models import LLMProvider__UserGroup
from onyx.db.models import Persona
from onyx.db.models import User
from onyx.db.models import User__UserGroup
from onyx.db.models import UserGroup
from onyx.llm.factory import get_llms_for_persona
from tests.integration.common_utils.managers.user import UserManager
from tests.integration.common_utils.test_models import DATestUser


def _create_llm_provider(
    db_session,
    *,
    name: str,
    default_model_name: str,
    fast_model_name: str,
    is_public: bool,
    is_default: bool,
) -> LLMProviderModel:
    provider = LLMProviderModel(
        name=name,
        provider="openai",
        api_key=None,
        api_base=None,
        api_version=None,
        custom_config=None,
        default_model_name=default_model_name,
        fast_default_model_name=fast_model_name,
        deployment_name=None,
        is_public=is_public,
        is_default_provider=is_default,
        is_default_vision_provider=False,
        default_vision_model=None,
    )
    db_session.add(provider)
    db_session.flush()
    return provider


def _create_persona(
    db_session,
    *,
    name: str,
    provider_name: str,
) -> Persona:
    persona = Persona(
        name=name,
        description=f"{name} description",
        num_chunks=5,
        chunks_above=2,
        chunks_below=2,
        llm_relevance_filter=True,
        llm_filter_extraction=True,
        recency_bias=RecencyBiasSetting.AUTO,
        llm_model_provider_override=provider_name,
        llm_model_version_override="gpt-4o-mini",
        system_prompt="System prompt",
        task_prompt="Task prompt",
        datetime_aware=True,
        is_public=True,
    )
    db_session.add(persona)
    db_session.flush()
    return persona


@pytest.fixture()
def users(reset: None) -> tuple[DATestUser, DATestUser]:
    admin_user = UserManager.create(name="admin_user")
    basic_user = UserManager.create(name="basic_user")
    return admin_user, basic_user


def test_can_user_access_llm_provider_or_logic(
    users: tuple[DATestUser, DATestUser],
) -> None:
    admin_user, basic_user = users

    with get_session_with_current_tenant() as db_session:
        default_provider = _create_llm_provider(
            db_session,
            name="default-provider",
            default_model_name="gpt-4o",
            fast_model_name="gpt-4o-mini",
            is_public=True,
            is_default=True,
        )
        unrestricted_provider = _create_llm_provider(
            db_session,
            name="unrestricted-provider",
            default_model_name="gpt-4o",
            fast_model_name="gpt-4o-mini",
            is_public=False,
            is_default=False,
        )
        restricted_provider = _create_llm_provider(
            db_session,
            name="restricted-provider",
            default_model_name="gpt-4o-mini",
            fast_model_name="gpt-4o-mini",
            is_public=False,
            is_default=False,
        )

        allowed_persona = _create_persona(
            db_session,
            name="allowed-persona",
            provider_name=restricted_provider.name,
        )
        blocked_persona = _create_persona(
            db_session,
            name="blocked-persona",
            provider_name=restricted_provider.name,
        )

        access_group = UserGroup(name="access-group")
        db_session.add(access_group)
        db_session.flush()

        db_session.add(
            LLMProvider__UserGroup(
                llm_provider_id=restricted_provider.id,
                user_group_id=access_group.id,
            )
        )
        db_session.add(
            LLMProvider__Persona(
                llm_provider_id=restricted_provider.id,
                persona_id=allowed_persona.id,
            )
        )
        db_session.add(
            User__UserGroup(
                user_group_id=access_group.id,
                user_id=admin_user.id,
            )
        )
        db_session.flush()

        db_session.refresh(restricted_provider)
        db_session.refresh(unrestricted_provider)

        admin_model = db_session.get(User, admin_user.id)
        basic_model = db_session.get(User, basic_user.id)

        assert admin_model is not None
        assert basic_model is not None

        assert is_llm_provider_effectively_public(default_provider)
        assert is_llm_provider_effectively_public(unrestricted_provider)
        assert not is_llm_provider_effectively_public(restricted_provider)

        assert can_user_access_llm_provider(
            db_session=db_session,
            provider=restricted_provider,
            user=admin_model,
            persona=blocked_persona,
        )

        assert can_user_access_llm_provider(
            db_session=db_session,
            provider=restricted_provider,
            user=basic_model,
            persona=allowed_persona,
        )

        assert not can_user_access_llm_provider(
            db_session=db_session,
            provider=restricted_provider,
            user=basic_model,
            persona=blocked_persona,
        )


def test_get_llms_for_persona_falls_back_when_access_denied(
    users: tuple[DATestUser, DATestUser],
) -> None:
    admin_user, basic_user = users

    with get_session_with_current_tenant() as db_session:
        default_provider = _create_llm_provider(
            db_session,
            name="default-provider",
            default_model_name="gpt-4o",
            fast_model_name="gpt-4o-mini",
            is_public=True,
            is_default=True,
        )
        restricted_provider = _create_llm_provider(
            db_session,
            name="restricted-provider",
            default_model_name="gpt-4o-mini",
            fast_model_name="gpt-4o-mini",
            is_public=False,
            is_default=False,
        )

        persona = _create_persona(
            db_session,
            name="fallback-persona",
            provider_name=restricted_provider.name,
        )

        access_group = UserGroup(name="persona-group")
        db_session.add(access_group)
        db_session.flush()

        db_session.add(
            LLMProvider__UserGroup(
                llm_provider_id=restricted_provider.id,
                user_group_id=access_group.id,
            )
        )
        db_session.add(
            User__UserGroup(
                user_group_id=access_group.id,
                user_id=admin_user.id,
            )
        )
        db_session.flush()
        db_session.commit()

        db_session.refresh(default_provider)
        db_session.refresh(restricted_provider)
        db_session.refresh(persona)

        admin_model = db_session.get(User, admin_user.id)
        basic_model = db_session.get(User, basic_user.id)

        assert admin_model is not None
        assert basic_model is not None

        allowed_llm, _ = get_llms_for_persona(
            persona=persona,
            user=admin_model,
        )
        assert allowed_llm.config.model_name == restricted_provider.default_model_name

        fallback_llm, _ = get_llms_for_persona(
            persona=persona,
            user=basic_model,
        )
        assert fallback_llm.config.model_name == default_provider.default_model_name
