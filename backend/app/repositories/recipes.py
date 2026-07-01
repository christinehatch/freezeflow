from app.models import Recipe
from app.repositories.base import Repository
from app.schemas import RecipeCreate, RecipeUpdate


class RecipeRepository(Repository[Recipe, RecipeCreate, RecipeUpdate]):
    def __init__(self) -> None:
        super().__init__(Recipe)


recipe_repository = RecipeRepository()
